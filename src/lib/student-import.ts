// Importing students from a spreadsheet. Pure: it reads rows of text and says,
// for every row, either the student it would add or what's wrong. Nothing is
// saved here; the page shows this plan first and saves only the good rows.
//
// The columns are found by their header, in any order, so a file exported
// from the Students page can be filled in and imported back.

import type { Group, GuardianRelationship, SchoolData, Student, StudentStatus } from '../types'
import { GUARDIAN_RELATIONSHIPS } from '../types'
import type { StudentInput } from '../data/school-context'
import { formatPhone, guardianRelationshipLabel, isValidPhone, studentStatusLabel } from './format'
import { createId } from './id'
import { tr } from '../i18n'
import { groupIdsOf } from './membership'

type Field = 'name' | 'phone' | 'group' | 'parent' | 'relationship' | 'parentPhone' | 'parent2' | 'parent2Phone' | 'tuition' | 'priceNote' | 'status' | 'enrolled' | 'dob'

/** Header names each column may have (English, plus the current language through tr). */
const HEADERS: Record<Field, string[]> = {
  name: ['Student', 'Full name', 'Name', 'Student name'],
  phone: ['Student phone', 'Phone'],
  group: ['Group'],
  parent: ['Parent / guardian', 'Parent', 'Parent name', 'Guardian'],
  relationship: ['Relationship'],
  parentPhone: ['Parent phone', 'Guardian phone'],
  parent2: ['Second parent'],
  parent2Phone: ['Second parent phone'],
  tuition: ['Monthly tuition (UZS)', 'Monthly tuition', 'Monthly fee', 'Monthly fee (UZS)'],
  priceNote: ['Price note'],
  status: ['Status'],
  enrolled: ['Enrolled', 'Enrolled on', 'Start date'],
  dob: ['Date of birth', 'Birthday'],
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** The columns in the downloadable template, with one example row. */
export function importTemplate(groupExample?: Group): string[][] {
  return [
    [tr("Student"), tr("Student phone"), tr("Date of birth"), tr("Group"), tr("Parent / guardian"), tr("Relationship"), tr("Parent phone"), tr("Second parent"), tr("Second parent phone"), tr("Monthly tuition (UZS)"), tr("Price note"), tr("Status"), tr("Enrolled")],
    ['Aziz Karimov', '+998 90 123 45 67', '2012-03-15', groupExample?.name ?? '', 'Dilnoza Karimova', guardianRelationshipLabel.mother, '+998 91 234 56 78', '', '', groupExample ? String(groupExample.monthlyFee) : '', '', studentStatusLabel.active, ''],
  ]
}

export interface ImportRow {
  /** Row number in the spreadsheet (the header is row 1). */
  row: number
  name: string
  groupName: string
  phone: string
  /** The student that will be added, when the row is fine. */
  input?: StudentInput
  /** Why the row can't be imported. */
  problems: string[]
  /** Already in the system (or earlier in the file): skipped. */
  duplicate?: boolean
  /** Fine, but worth a look (e.g. the group will be over capacity). */
  notes: string[]
}

export interface ImportPlan {
  rows: ImportRow[]
  /** Headers that matched nothing, so the person knows they were ignored. */
  ignored: string[]
  /** Set when the file can't be used at all. */
  error?: string
}

/** Excel serial day number, YYYY-MM-DD, DD.MM.YYYY or DD/MM/YYYY → YYYY-MM-DD. */
export function parseDate(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  let y: number, m: number, d: number
  let match
  if (/^\d{4,5}(\.\d+)?$/.test(v) && Number(v) > 10000 && Number(v) < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86_400_000)
    return date.toISOString().slice(0, 10)
  } else if ((match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else if ((match = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString().slice(0, 10)
}

const digits = (phone: string) => phone.replace(/\D/g, '').slice(-9)

/**
 * Works out what importing these rows would do. `fallbackBranch` is where
 * students without a group go (null when no branch is chosen).
 */
export function planImport(sheet: string[][], data: SchoolData, opts: { today: string; fallbackBranch: string | null }): ImportPlan {
  const headerIndex = sheet.findIndex((r) => r.some((c) => c.trim()))
  if (headerIndex === -1) return { rows: [], ignored: [], error: tr("The file is empty.") }
  const header = sheet[headerIndex].map(norm)
  const col: Partial<Record<Field, number>> = {}
  for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) {
    const wanted = new Set(names.flatMap((n) => [norm(n), norm(tr(n))]))
    const i = header.findIndex((h) => wanted.has(h))
    if (i !== -1) col[field] = i
  }
  if (col.name === undefined) return { rows: [], ignored: [], error: tr("No “Student” column found. Download the template and keep its first row.") }
  const known = new Set(Object.values(col))
  const ignored = sheet[headerIndex].filter((h, i) => h.trim() && !known.has(i))

  const statusByLabel = new Map<string, StudentStatus>()
  for (const s of ['active', 'paused', 'left', 'graduated'] as StudentStatus[]) {
    statusByLabel.set(norm(s), s)
    statusByLabel.set(norm(studentStatusLabel[s]), s)
  }
  const relationByLabel = new Map<string, GuardianRelationship>()
  for (const r of GUARDIAN_RELATIONSHIPS) {
    relationByLabel.set(norm(r), r)
    relationByLabel.set(norm(guardianRelationshipLabel[r]), r)
  }
  const groupsByName = new Map<string, Group[]>()
  for (const g of data.groups) groupsByName.set(norm(g.name), [...(groupsByName.get(norm(g.name)) ?? []), g])

  // Who is already here: same name and a shared phone number means the same student.
  const existing = new Set<string>()
  const keyFor = (name: string, phones: string[]) => phones.filter((p) => p.length === 9).map((p) => `${norm(name)}|${p}`)
  for (const s of data.students) for (const k of keyFor(s.fullName, [s.phone, ...s.guardians.map((g) => g.phone)].map(digits))) existing.add(k)
  const seen = new Set<string>()
  const joining = new Map<string, number>()
  const enrolled = new Map<string, number>()
  for (const s of data.students) if (s.status === 'active' || s.status === 'paused') for (const id of groupIdsOf(s)) enrolled.set(id, (enrolled.get(id) ?? 0) + 1)

  const rows: ImportRow[] = []
  sheet.slice(headerIndex + 1).forEach((cells, i) => {
    const get = (f: Field) => (col[f] === undefined ? '' : (cells[col[f]!] ?? '').trim())
    if (!cells.some((c) => c.trim())) return
    const problems: string[] = []
    const notes: string[] = []
    const name = get('name').replace(/\s+/g, ' ')
    const out: ImportRow = { row: headerIndex + i + 2, name, groupName: get('group'), phone: get('phone') || get('parentPhone'), problems, notes }
    rows.push(out)

    if (name.length < 2) problems.push(tr("The student’s name is missing."))

    const phone = get('phone')
    if (phone && !isValidPhone(phone)) problems.push(tr("Student phone “{0}” isn’t a valid number.", phone))
    const parents: Student['guardians'] = []
    for (const [nameF, phoneF, first] of [['parent', 'parentPhone', true], ['parent2', 'parent2Phone', false]] as const) {
      const pName = get(nameF)
      const pPhone = get(phoneF)
      if (!pName && !pPhone) continue
      if (pPhone && !isValidPhone(pPhone)) {
        problems.push(tr("Parent phone “{0}” isn’t a valid number.", pPhone))
        continue
      }
      if (!pPhone) {
        problems.push(tr("{0} has no phone number.", pName))
        continue
      }
      const relLabel = first ? get('relationship') : ''
      const relationship = relLabel ? relationByLabel.get(norm(relLabel)) : undefined
      if (relLabel && !relationship) notes.push(tr("“{0}” isn’t a known relationship; saved as Guardian.", relLabel))
      parents.push({ id: createId('gdn'), fullName: pName || tr("Parent"), relationship: relationship ?? (first ? 'mother' : 'father'), phone: formatPhone(pPhone) })
    }
    if (!phone && parents.length === 0 && !problems.length) problems.push(tr("Add a student or parent phone number."))

    let group: Group | undefined
    if (out.groupName) {
      const matches = groupsByName.get(norm(out.groupName)) ?? []
      if (matches.length === 0) problems.push(tr("No group called “{0}”. Check the spelling on the Groups page.", out.groupName))
      else if (matches.length > 1) problems.push(tr("{0} groups are called “{1}”. Rename one so they can be told apart.", matches.length, out.groupName))
      else group = matches[0]
      if (group && group.status !== 'active') notes.push(tr("{0} isn’t running at the moment.", group.name))
    } else if (!opts.fallbackBranch) problems.push(tr("Give a group, or choose a branch at the top of the page first."))

    const statusText = get('status')
    const status = statusText ? statusByLabel.get(norm(statusText)) : 'active'
    if (!status) problems.push(tr("Status “{0}” isn’t known. Use Active or Paused.", statusText))
    else if (status !== 'active' && status !== 'paused') problems.push(tr("Only current students can be imported (Active or Paused)."))

    const tuitionText = get('tuition').replace(/[\s,]/g, '').replace(/uzs|so[‘'`]?m|сум/gi, '')
    let tuition = group?.monthlyFee
    if (tuitionText) {
      const n = Number(tuitionText)
      if (!Number.isFinite(n) || n <= 0 || n > 50_000_000) problems.push(tr("Monthly tuition “{0}” isn’t a valid amount.", get('tuition')))
      else tuition = Math.round(n)
    }
    if (tuition === undefined && !tuitionText && !(out.groupName && !group)) problems.push(tr("Enter the monthly tuition (there’s no group to take it from)."))

    const enrolledText = get('enrolled')
    const enrolledOn = enrolledText ? parseDate(enrolledText) : opts.today
    if (!enrolledOn) problems.push(tr("Enrolled date “{0}” isn’t a date. Use 2026-11-05 or 05.11.2026.", enrolledText))
    else if (enrolledOn > opts.today) problems.push(tr("Enrolled date is in the future."))
    const dobText = get('dob')
    const dateOfBirth = dobText ? parseDate(dobText) : null
    if (dobText && !dateOfBirth) problems.push(tr("Date of birth “{0}” isn’t a date.", dobText))

    const keys = keyFor(name, [phone, ...parents.map((p) => p.phone)].map(digits))
    if (keys.some((k) => existing.has(k))) {
      out.duplicate = true
      return
    }
    if (keys.some((k) => seen.has(k))) {
      out.duplicate = true
      notes.push(tr("Same student as an earlier row."))
      return
    }
    if (problems.length) return
    keys.forEach((k) => seen.add(k))

    if (group) {
      const count = (enrolled.get(group.id) ?? 0) + (joining.get(group.id) ?? 0) + 1
      joining.set(group.id, (joining.get(group.id) ?? 0) + 1)
      if (count > group.capacity) notes.push(tr("{0} will have {1} students for {2} seats.", group.name, count, group.capacity))
    }
    const priceNote = get('priceNote')
    out.input = {
      fullName: name,
      phone: phone ? formatPhone(phone) : '',
      guardians: parents,
      groupId: group?.id ?? null,
      enrolledOn: enrolledOn!,
      monthlyTuition: tuition!,
      status: status!,
      ...(dateOfBirth ? { dateOfBirth } : {}),
      ...(group && tuition !== group.monthlyFee ? { tuitionAdjustment: { kind: 'special_price' as const, reason: priceNote || tr("Imported from Excel") } } : {}),
    }
  })
  return { rows, ignored }
}

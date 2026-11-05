// Sample front-office and finance data: the lists the school manages
// (payment methods, expense categories, tags, reasons), accountant
// accounts, receipts, expenses, salary payouts, staff attendance,
// call/message logs and extra lessons. Used by the demo generator and by the
// upgrade of older saved data. Derived from ids and dates, so the same demo
// day always gives the same records.

import { levelId } from '../lib/courses'
import type {
  Catalogs,
  ContactLog,
  Course,
  Expense,
  ExtraLesson,
  Group,
  ListItem,
  Payment,
  SalaryPayment,
  SchoolData,
  StaffAttendance,
  StaffMark,
  Student,
  Teacher,
  User,
} from '../types'
import { addDays, addMonths, atTime, isoWeekday, monthKey, monthRange, toISODate } from '../lib/dates'
import { meetsOn } from '../lib/schedule'
import { teacherSalary } from '../lib/salary'
import { randomFor } from './seed-learning'
import { defaultLeadStages } from '../lib/lead-stages'

const item = (prefix: string, name: string): ListItem => ({ id: `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`, name, active: true })

export function seedCatalogs(): Catalogs {
  return {
    // Ids match the methods stored on older payments.
    paymentMethods: [
      { id: 'cash', name: 'Cash', active: true },
      { id: 'card', name: 'Card (Uzcard/Humo)', active: true },
      { id: 'click', name: 'Click', active: true },
      { id: 'payme', name: 'Payme', active: true },
      { id: 'transfer', name: 'Bank transfer', active: true },
    ],
    expenseCategories: ['Rent', 'Utilities', 'Marketing', 'Equipment', 'Staff salaries', 'Cleaning and supplies', 'Other'].map((n) => item('exp', n)),
    studentTags: ['Sibling', 'VIP', 'Needs follow-up', 'Exam this year', 'Scholarship'].map((n) => item('tag', n)),
    pauseReasons: ['School exams', 'Travelling', 'Health', 'Money is tight this month', 'Other'].map((n) => item('pause', n)),
    leaveReasons: ['Moved away', 'Schedule clash', 'Reached their goal', 'Price', 'Chose another centre', 'Not happy with the lessons', 'Other'].map((n) => item('leave', n)),
    leadSources: ['Instagram', 'Telegram channel', 'Friend’s recommendation', 'Walk-in', 'Google Maps', 'School flyer', 'Phone call', 'Other'].map((n) => item('src', n)),
  }
}

const COURSE_LEVELS: Record<string, { levels: string[]; fee: number }> = {
  English: { levels: ['Kids', 'Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate', 'Adults'], fee: 450_000 },
  'IELTS Preparation': { levels: ['Foundation 5.5', '6.0', '6.5+', 'Speaking', 'Writing'], fee: 650_000 },
  Mathematics: { levels: ['Grade 7–8', 'Grade 9–11', 'University admission', 'SAT'], fee: 500_000 },
  'Computer Science': { levels: ['Kids', 'Computer literacy', 'Python', 'Web'], fee: 600_000 },
  Russian: { levels: ['Beginner', 'Elementary'], fee: 400_000 },
  Korean: { levels: ['Beginner'], fee: 450_000 },
}

export function withCourseLevels(courses: Course[]): Course[] {
  return courses.map((c) =>
    c.levels?.length
      ? c
      : { ...c, levels: (COURSE_LEVELS[c.name]?.levels ?? []).map((name) => ({ id: levelId(c.id, name), name, active: true })), defaultFee: COURSE_LEVELS[c.name]?.fee },
  )
}

/** The level a sample group teaches, worked out from its name. */
function levelFor(group: Group): string | undefined {
  const levels = COURSE_LEVELS[group.subject]?.levels ?? []
  return levels.find((l) => group.name.toLowerCase().includes(l.toLowerCase().split(' ')[0]))
}

const OFFICE_STAFF: Record<string, string> = {
  br_bashlik: 'Ozoda Mirzayeva',
  br_chilonzor: 'Nodira Sobirova',
  br_quyliq: 'Lola Karimova',
}

/** One accountant at each branch (demo accounts). The branch administrator also runs the front desk. */
export function officeUsers(branchIds: string[], now: Date): User[] {
  return branchIds.map((branchId) => {
    const short = branchId.replace('br_', '')
    return { id: `usr_accountant_${short}`, role: 'accountant' as const, fullName: OFFICE_STAFF[branchId] ?? 'Accountant', username: `accountant.${short}`, branchId, active: true, createdAt: now.toISOString() }
  })
}

const BRANCH_CODE: Record<string, string> = { br_bashlik: 'BA', br_chilonzor: 'CH', br_quyliq: 'QU' }

/** Receipt numbers per branch in date order, e.g. "CH-000123". Payments that have one keep it. */
export function withReceipts(payments: Payment[], students: Student[]): Payment[] {
  const branchOf = new Map(students.map((s) => [s.id, s.branchId]))
  const counters = new Map<string, number>()
  for (const p of payments) {
    const m = p.receiptNo?.match(/^([A-Z]+)-(\d+)$/)
    if (m) counters.set(m[1], Math.max(counters.get(m[1]) ?? 0, Number(m[2])))
  }
  const ordered = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const numbers = new Map<string, string>()
  for (const p of ordered) {
    if (p.receiptNo) continue
    const code = BRANCH_CODE[branchOf.get(p.studentId) ?? ''] ?? 'SS'
    const n = (counters.get(code) ?? 0) + 1
    counters.set(code, n)
    numbers.set(p.id, `${code}-${String(n).padStart(6, '0')}`)
  }
  return payments.map((p) => (p.receiptNo ? p : { ...p, receiptNo: numbers.get(p.id) }))
}

// ---------------------------------------------------------------- expenses

const RENT: Record<string, number> = { br_bashlik: 9_000_000, br_chilonzor: 12_000_000, br_quyliq: 8_000_000 }

export function seedExpenses(branchIds: string[], catalogs: Catalogs, adminFor: (b: string) => string | undefined, now: Date): Expense[] {
  const today = toISODate(now)
  const cat = (name: string) => catalogs.expenseCategories.find((c) => c.name === name)!.id
  const items: Expense[] = []
  const add = (branchId: string | null, category: string, amount: number, date: string, description: string, paidTo?: string) => {
    if (date > today) return
    items.push({
      id: `exp_${branchId ?? 'org'}_${date}_${category.slice(0, 4).toLowerCase()}_${items.length}`,
      branchId,
      categoryId: cat(category),
      amount,
      date,
      description,
      ...(paidTo ? { paidTo } : {}),
      method: amount >= 2_000_000 ? 'transfer' : 'cash',
      createdBy: branchId ? adminFor(branchId) : 'usr_owner',
      createdAt: atTime(date, '12:00').toISOString(),
    })
  }
  const current = monthKey(now)
  for (const month of monthRange(addMonths(current, -5), current)) {
    for (const branchId of branchIds) {
      const rand = randomFor(branchId, month, 'expenses')
      add(branchId, 'Rent', RENT[branchId] ?? 8_000_000, `${month}-0${rand.int(1, 3)}`, 'Monthly rent', 'Building owner')
      add(branchId, 'Utilities', Math.round(rand.int(12, 22) * 100_000), `${month}-${rand.int(10, 14)}`, 'Electricity, water, internet')
      add(branchId, 'Cleaning and supplies', Math.round(rand.int(3, 7) * 100_000), `${month}-${rand.int(15, 20)}`, 'Cleaning, paper, markers')
      add(branchId, 'Staff salaries', 4_500_000, `${month}-05`, 'Accountant')
      if (rand.chance(0.5)) add(branchId, 'Marketing', Math.round(rand.int(10, 25) * 100_000), `${month}-${rand.int(10, 25)}`, rand.pick(['Flyers near schools', 'Banner outside the branch', 'Local Telegram ads']))
      if (rand.chance(0.25)) add(branchId, 'Equipment', Math.round(rand.int(15, 60) * 100_000), `${month}-${rand.int(10, 25)}`, rand.pick(['New whiteboard', 'Projector repair', 'Two computers for the lab', 'Chairs for Room 102']))
    }
    // Organisation-wide: online marketing paid by head office.
    add(null, 'Marketing', 2_500_000, `${month}-02`, 'Instagram and Telegram ads (all branches)', 'Ad agency')
  }
  return items
}

// ---------------------------------------------------------------- salary payouts

/**
 * Salaries for past months paid out on the 5th of the next month. Last
 * month's are still unpaid for some teachers when it's early in the month.
 */
export function seedSalaryPayments(data: SchoolData, now: Date): SalaryPayment[] {
  const current = monthKey(now)
  const today = toISODate(now)
  const out: SalaryPayment[] = []
  for (const month of monthRange(addMonths(current, -5), addMonths(current, -1))) {
    const payDay = `${addMonths(month, 1)}-05`
    for (const t of data.teachers) {
      const amount = teacherSalary(data, t.id, month).amount
      if (amount <= 0) continue
      const rand = randomFor(t.id, month, 'salary')
      if (payDay > today && rand.chance(0.6)) continue
      out.push({
        id: `sal_${t.id}_${month}`,
        teacherId: t.id,
        month,
        amount,
        date: payDay > today ? today : payDay,
        method: rand.chance(0.7) ? 'transfer' : 'cash',
        paidBy: `usr_accountant_${t.branchId.replace('br_', '')}`,
        createdAt: atTime(payDay > today ? today : payDay, '15:00').toISOString(),
      })
    }
  }
  return out
}

// ---------------------------------------------------------------- staff attendance

/** The last two weeks of arrivals for teachers (on days they teach) and front-office staff. */
export function seedStaffAttendance(data: SchoolData, now: Date): StaffAttendance[] {
  const out: StaffAttendance[] = []
  const today = toISODate(now)
  for (let i = 14; i >= 1; i--) {
    const day = addDays(now, -i)
    if (isoWeekday(day) === 7) continue
    const date = toISODate(day)
    const mark = (personType: 'teacher' | 'user', personId: string, branchId: string, start: string) => {
      const rand = randomFor(personId, date, 'staff')
      const roll = rand.next()
      const m: StaffMark = roll < 0.86 ? 'present' : roll < 0.95 ? 'late' : roll < 0.98 ? 'excused' : 'absent'
      const [h, min] = start.split(':').map(Number)
      const arrive = m === 'present' ? h * 60 + min - rand.int(5, 20) : m === 'late' ? h * 60 + min + rand.int(5, 25) : null
      out.push({
        id: `stf_${personId}_${date}`,
        branchId,
        date,
        personId,
        personType,
        mark: m,
        ...(arrive !== null ? { arrivedAt: `${String(Math.floor(arrive / 60)).padStart(2, '0')}:${String(arrive % 60).padStart(2, '0')}` } : {}),
        ...(m === 'excused' ? { note: 'Doctor’s appointment, agreed in advance' } : {}),
        recordedBy: `usr_admin_${branchId.replace('br_', '')}`,
        savedAt: atTime(date, '10:00').toISOString(),
      })
    }
    for (const t of data.teachers) {
      if (t.status !== 'active') continue
      const first = data.groups.filter((g) => g.teacherId === t.id && meetsOn(g, date)).sort((a, b) => a.startTime.localeCompare(b.startTime))[0]
      if (first) mark('teacher', t.id, t.branchId, first.startTime)
    }
    for (const u of data.users) if ((u.role === 'admin' || u.role === 'accountant') && u.branchId) mark('user', u.id, u.branchId, '09:00')
  }
  return out.filter((r) => r.date < today)
}

// ---------------------------------------------------------------- calls and messages

const LEAD_CALLS = ['Explained the timetable and prices', 'Asked to call back in the evening', 'Interested, wants a trial lesson', 'Sent the price list on Telegram', 'Parent will decide after the weekend']
const DEBT_CALLS = ['Mother promised to pay by Friday', 'Father will pay on payday (the 15th)', 'No answer, will try again tomorrow', 'Paying half now and half next week']

export function seedContactLogs(data: SchoolData, overdue: Student[], now: Date): ContactLog[] {
  const out: ContactLog[] = []
  const adminFor = (b: string) => data.users.find((u) => u.role === 'admin' && u.branchId === b)?.id
  for (const lead of data.leads) {
    if (lead.stage === 'new') continue
    const rand = randomFor(lead.id, 'calls')
    const n = lead.stage === 'contacted' ? 1 : rand.int(1, 3)
    for (let i = 0; i < n; i++) {
      const at = new Date(new Date(lead.createdAt).getTime() + (i + 1) * rand.int(3, 30) * 3_600_000)
      if (at > now) break
      out.push({
        id: `log_${lead.id}_${i}`,
        branchId: lead.branchId,
        subject: { type: 'lead', id: lead.id },
        channel: i === 1 && rand.chance(0.5) ? 'telegram' : 'call',
        direction: i === 0 && rand.chance(0.3) ? 'incoming' : 'outgoing',
        withWhom: lead.parentName ?? lead.studentName,
        summary: rand.pick(LEAD_CALLS),
        at: at.toISOString(),
        byUserId: adminFor(lead.branchId),
      })
    }
  }
  for (const s of overdue) {
    const rand = randomFor(s.id, 'debt-call')
    const g = s.guardians[0]
    out.push({
      id: `log_${s.id}_debt`,
      branchId: s.branchId,
      subject: { type: 'student', id: s.id },
      channel: rand.chance(0.7) ? 'call' : 'sms',
      direction: 'outgoing',
      withWhom: g ? `${g.fullName} (${g.relationship})` : s.fullName,
      summary: rand.pick(DEBT_CALLS),
      followUpOn: toISODate(addDays(now, rand.int(1, 5))),
      at: atTime(toISODate(addDays(now, -rand.int(1, 6))), `${rand.int(10, 17)}:${String(rand.int(0, 59)).padStart(2, '0')}`).toISOString(),
      byUserId: adminFor(s.branchId),
    })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

// ---------------------------------------------------------------- extra lessons

export function seedExtraLessons(data: SchoolData, now: Date): ExtraLesson[] {
  const out: ExtraLesson[] = []
  const today = toISODate(now)
  const groupById = new Map(data.groups.map((g) => [g.id, g]))
  const active = data.students.filter((s) => s.status === 'active' && s.groupId)
  active.forEach((s, i) => {
    if (i % 14 !== 3) return
    const g = groupById.get(s.groupId!)!
    const rand = randomFor(s.id, 'extra')
    const offset = rand.int(-20, 10)
    const date = toISODate(addDays(now, offset))
    if (isoWeekday(addDays(now, offset)) === 7) return
    const past = date < today
    out.push({
      id: `xl_${s.id}`,
      studentId: s.id,
      branchId: s.branchId,
      teacherId: g.teacherId,
      date,
      time: rand.pick(['10:00', '12:30', '13:00']),
      durationMinutes: 60,
      topic: rand.pick(['Catching up after an absence', 'Exam practice', 'Speaking practice', 'Revision before the monthly test']),
      fee: rand.chance(0.6) ? 100_000 : 0,
      status: past ? (rand.chance(0.9) ? 'done' : 'cancelled') : 'planned',
      paid: past && rand.chance(0.8),
      createdAt: atTime(toISODate(addDays(now, offset - 3)), '18:00').toISOString(),
    })
  })
  return out
}

// ---------------------------------------------------------------- all together

type Base = Omit<SchoolData, 'catalogs' | 'extraLessons' | 'expenses' | 'salaryPayments' | 'staffAttendance' | 'contactLogs' | 'leadStages'> & { leadStages?: SchoolData['leadStages'] }

/**
 * Adds the office and finance records to data that doesn't have them yet.
 * `demo` also tags some students and gives two teachers a fixed or mixed
 * salary: sample choices that only make sense for freshly generated data.
 */
/** Active students with nothing paid for last month: the ones an administrator would call. */
function likelyOverdue(data: SchoolData, now: Date): Student[] {
  const last = addMonths(monthKey(now), -1)
  const paid = new Set(data.payments.filter((p) => p.status === 'paid' && p.period === last).map((p) => p.studentId))
  return data.students.filter((s) => s.status === 'active' && s.enrolledOn < `${last}-01` && !paid.has(s.id))
}

export function addOfficeData(base: Base, now: Date, { demo }: { demo: boolean }): SchoolData {
  const catalogs = seedCatalogs()
  const users = [...base.users, ...officeUsers(base.branches.map((b) => b.id), now).filter((u) => !base.users.some((x) => x.id === u.id || x.username === u.username))]
  const adminFor = (b: string) => users.find((u) => u.role === 'admin' && u.branchId === b)?.id
  let teachers: Teacher[] = base.teachers
  let students: Student[] = base.students
  if (demo) {
    teachers = teachers.map((t) =>
      t.id === 'tch_08' ? { ...t, salaryKind: 'mixed' as const, fixedSalary: 1_500_000 } : t.id === 'tch_09' ? { ...t, salaryKind: 'fixed' as const, fixedSalary: 4_000_000 } : t,
    )
    const tag = (name: string) => catalogs.studentTags.find((c) => c.name === name)!.id
    const groupName = new Map(base.groups.map((g) => [g.id, g.name]))
    students = students.map((s) => {
      const rand = randomFor(s.id, 'tags')
      const tags: string[] = []
      if (s.tuitionAdjustment?.reason.startsWith('Sibling')) tags.push(tag('Sibling'))
      if (/IELTS|SAT|Admission/.test(groupName.get(s.groupId ?? '') ?? '') && rand.chance(0.4)) tags.push(tag('Exam this year'))
      if (rand.chance(0.05)) tags.push(tag('Needs follow-up'))
      if (rand.chance(0.03)) tags.push(tag('VIP'))
      return tags.length ? { ...s, tags } : s
    })
  }
  const groups = base.groups.map((g) => (g.level ? g : { ...g, level: levelFor(g) }))
  const withOffice: SchoolData = {
    ...base,
    users,
    teachers,
    students,
    groups,
    courses: withCourseLevels(base.courses),
    payments: withReceipts(base.payments, students),
    catalogs,
    leadStages: base.leadStages ?? defaultLeadStages(),
    extraLessons: [],
    expenses: [],
    salaryPayments: [],
    staffAttendance: [],
    contactLogs: [],
  }
  return {
    ...withOffice,
    expenses: seedExpenses(base.branches.map((b) => b.id), catalogs, adminFor, now),
    salaryPayments: seedSalaryPayments(withOffice, now),
    staffAttendance: seedStaffAttendance(withOffice, now),
    contactLogs: seedContactLogs(withOffice, likelyOverdue(withOffice, now), now),
    extraLessons: seedExtraLessons(withOffice, now),
  }
}

import { CalendarX2, Phone, Presentation, UserRoundX, Wallet, type LucideIcon } from 'lucide-react'
import type { Section } from '../../app/permissions'
import { formatUZSCompact } from '../../lib/format'
import type { AttentionItem } from '../../lib/metrics'
import { tr } from '../../i18n'

/** One summary row: what is wrong, how many, and the filtered page that fixes it. */
export interface AttentionRow {
  key: string
  icon: LucideIcon
  tint: string
  label: string
  detail: string
  count: number
  to: string
  /** The section `to` belongs to; rows the person can't open are left out. */
  section: Section
}

const MAX_ROWS = 4

/**
 * Turns the individual attention items (the same ones the header bell lists)
 * into at most four summary rows, most urgent first. Each row opens a list
 * already filtered to the cause.
 */
export function attentionRows(items: AttentionItem[], overdueTotal: number, allowed: (section: Section) => boolean): AttentionRow[] {
  const of = (kind: AttentionItem['kind']) => items.filter((i) => i.kind === kind)
  const rows: AttentionRow[] = []

  const missing = of('attendance_missing')
  if (missing.length) {
    // Oldest first: that's the class most likely to be forgotten.
    const first = [...missing].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]
    rows.push({
      key: 'attendance',
      icon: CalendarX2,
      tint: 'bg-danger-soft text-danger',
      label: tr("Attendance not taken"),
      detail: tr("Classes that have ended without attendance"),
      count: missing.length,
      to: `/attendance?group=${first.groupId}&date=${first.date}`,
      section: 'attendance',
    })
  }

  const overdue = of('overdue')
  if (overdue.length) {
    rows.push({
      key: 'overdue',
      icon: Wallet,
      tint: 'bg-danger-soft text-danger',
      label: tr("Tuition overdue"),
      detail: tr("{0} owed in total", formatUZSCompact(overdueTotal)),
      count: overdue.length,
      to: '/students?tuition=overdue',
      section: 'students',
    })
  }

  const noTeacher = of('teacher_away')
  if (noTeacher.length) {
    rows.push({
      key: 'no-teacher',
      icon: UserRoundX,
      tint: 'bg-warning-soft text-warning',
      label: tr("Group without a teacher"),
      detail: tr("Running groups with no active teacher"),
      count: noTeacher.length,
      to: noTeacher.length === 1 ? `/groups?q=${encodeURIComponent(noTeacher[0].title)}` : '/groups',
      section: 'groups',
    })
  }

  const trialsToday = of('trial_today').length
  const trialsWaiting = of('trial_result').length
  if (trialsToday + trialsWaiting) {
    rows.push({
      key: 'trials',
      icon: Presentation,
      tint: 'bg-brand-soft text-brand-ink',
      label: tr("Trial lessons"),
      detail: tr("{0} today, {1} waiting for a result", trialsToday, trialsWaiting),
      count: trialsToday + trialsWaiting,
      to: '/leads?view=list&stage=trial_scheduled',
      section: 'leads',
    })
  }

  const newLeads = of('lead_new')
  if (newLeads.length) {
    rows.push({
      key: 'leads',
      icon: Phone,
      tint: 'bg-brand-soft text-brand-ink',
      label: tr("New enquiries to call"),
      detail: tr("Still at the first stage"),
      count: newLeads.length,
      to: '/leads?view=list&stage=new',
      section: 'leads',
    })
  }

  return rows.filter((r) => allowed(r.section)).slice(0, MAX_ROWS)
}

import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data/seed'
import { attentionItems, computeBalances, outstandingTotal } from './metrics'
import { scopeData } from './scope'

const NOW = new Date(2026, 10, 4, 16, 0) // Wed 4 Nov 2026
const full = createDemoData(NOW)
const admin = full.users.find((u) => u.username === 'admin.chilonzor')!
const data = scopeData(full, admin)
const balances = computeBalances(data, NOW)

describe('administrator dashboard numbers', () => {
  it('overdue tuition is part of what is owed, and matches the per-student balances', () => {
    const totals = outstandingTotal(balances)
    const overdue = [...balances.values()].filter((b) => b.status === 'overdue')
    expect(totals.overdueStudents).toBe(overdue.length)
    expect(totals.overdueTotal).toBe(overdue.reduce((sum, b) => sum + b.owed, 0))
    expect(totals.overdueTotal).toBeLessThanOrEqual(totals.total)
  })

  it('lists one overdue task per overdue student', () => {
    const items = attentionItems(data, NOW, balances)
    expect(items.filter((i) => i.kind === 'overdue')).toHaveLength(outstandingTotal(balances).overdueStudents)
  })

  it('flags a running group whose teacher goes on leave', () => {
    const group = data.groups.find((g) => g.status === 'active')!
    const onLeave = { ...data, teachers: data.teachers.map((t) => (t.id === group.teacherId ? { ...t, status: 'on_leave' as const } : t)) }
    const items = attentionItems(onLeave, NOW, balances).filter((i) => i.kind === 'teacher_away')
    expect(items.map((i) => i.groupId)).toContain(group.id)
    expect(attentionItems(data, NOW, balances).some((i) => i.kind === 'teacher_away')).toBe(false)
  })

  it('every student in the branch has a parent or is an adult with their own phone', () => {
    for (const s of data.students) expect(s.guardians.length > 0 || s.phone.length > 0).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { AttendanceRecord, SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { demoSignIn, DEMO_PASSWORD } from './auth'
import { can, canOpen, sectionForPath } from '../app/permissions'
import { scopeData } from './scope'
import { summarizeMarks } from './metrics'
import { teacherSalary } from './salary'
import { methodName, listName } from './format'
import { toXlsx } from './xlsx'
import { addMonths, monthKey, monthRange } from './dates'
import { groupRanking, profitByMonth, retention, studentRanking, teacherPerformance } from './reports'

const NOW = new Date(2026, 10, 4, 16, 0) // Wed 4 Nov 2026
const data = createDemoData(NOW)
const month = monthKey(NOW)
const from = addMonths(month, -5)

describe('version 7 data', () => {
  it('is valid and has the office records', () => {
    expect(data.version).toBe(DATA_VERSION)
    expect(validateSchoolData(data)).toBeNull()
    expect(data.catalogs.paymentMethods.map((m) => m.id)).toEqual(['cash', 'card', 'click', 'payme', 'transfer'])
    expect(data.expenses.length).toBeGreaterThan(0)
    expect(data.salaryPayments.length).toBeGreaterThan(0)
    expect(data.users.some((u) => u.role === 'reception')).toBe(true)
    expect(data.users.some((u) => u.role === 'accountant')).toBe(true)
  })

  it('upgrades version 6 data without losing anything', () => {
    const v6 = JSON.parse(JSON.stringify({ ...data, version: 6 })) as Record<string, unknown>
    for (const key of ['catalogs', 'extraLessons', 'expenses', 'salaryPayments', 'staffAttendance', 'contactLogs']) delete v6[key]
    v6.users = data.users.filter((u) => u.role !== 'reception' && u.role !== 'accountant')
    v6.payments = data.payments.map(({ receiptNo: _r, ...p }) => p)
    const up = migrate(v6, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(up)).toBeNull()
    expect(up.students).toHaveLength(data.students.length)
    expect(up.payments).toHaveLength(data.payments.length)
    expect(up.payments.every((p) => /^[A-Z]{2}-\d{6}$/.test(p.receiptNo ?? ''))).toBe(true)
    expect(up.catalogs.leaveReasons.length).toBeGreaterThan(0)
  })

  it('numbers receipts per branch without repeats', () => {
    const numbers = data.payments.map((p) => p.receiptNo)
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

describe('roles', () => {
  it('reception and accountant see only their sections', () => {
    expect(can('reception', 'leads')).toBe(true)
    expect(can('reception', 'expenses')).toBe(false)
    expect(can('reception', 'reports')).toBe(false)
    expect(can('accountant', 'expenses')).toBe(true)
    expect(can('accountant', 'leads')).toBe(false)
    expect(canOpen('accountant', '/payments/pay_1/receipt')).toBe(true)
    expect(canOpen('reception', '/salaries')).toBe(false)
    expect(sectionForPath('/staff-attendance')).toBe('staffAttendance')
    expect(sectionForPath('/students/stu_001')).toBe('students')
  })

  it('a turned-off account cannot sign in', () => {
    const reception = data.users.find((u) => u.role === 'reception')!
    expect(demoSignIn(data.users, reception.username, DEMO_PASSWORD)?.id).toBe(reception.id)
    const users = data.users.map((u) => (u.id === reception.id ? { ...u, active: false } : u))
    expect(demoSignIn(users, reception.username, DEMO_PASSWORD)).toBeNull()
  })

  it('front-office staff only see their own branch', () => {
    const accountant = data.users.find((u) => u.role === 'accountant')!
    const scoped = scopeData(data, accountant)
    expect(scoped.students.every((s) => s.branchId === accountant.branchId)).toBe(true)
    expect(scoped.expenses.every((e) => e.branchId === accountant.branchId)).toBe(true)
  })
})

describe('excused absences', () => {
  it('are left out of the attendance rate', () => {
    const rec = (marks: AttendanceRecord['marks']) => ({ id: 'a', groupId: 'g', date: '2026-11-02', startTime: '14:00', teacherId: 't', marks, savedAt: '' }) as AttendanceRecord
    const s = summarizeMarks([rec({ a: 'present', b: 'late', c: 'absent', d: 'excused' })])
    expect(s.excused).toBe(1)
    expect(s.total).toBe(3)
    expect(s.rate).toBeCloseTo(2 / 3)
  })
})

describe('salary kinds', () => {
  it('fixed pays only the fixed amount, mixed adds the share', () => {
    const fixed = teacherSalary(data, 'tch_09', month)
    expect(fixed.share).toBe(0)
    expect(fixed.amount).toBe(4_000_000)
    const mixed = teacherSalary(data, 'tch_08', month)
    expect(mixed.fixed).toBe(1_500_000)
    expect(mixed.amount).toBe(mixed.share + 1_500_000)
  })
})

describe('managed lists', () => {
  it('show names, and fall back to the stored value for unknown ids', () => {
    expect(methodName(data.catalogs, 'click')).toBe('Click')
    expect(methodName(data.catalogs, 'uzum')).toBe('uzum')
    const tag = data.catalogs.studentTags[0]
    expect(listName(data.catalogs.studentTags, tag.id)).toBe(tag.name)
  })
})

describe('excel export', () => {
  it('writes a zip with the workbook parts and escapes text', () => {
    const bytes = toXlsx([['Name', 'Amount'], ['A & B <c>', 1200]], 'Test')
    expect(bytes[0]).toBe(0x50) // "PK"
    expect(bytes[1]).toBe(0x4b)
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('xl/worksheets/sheet1.xml')
    expect(text).toContain('A &amp; B &lt;c&gt;')
    expect(text).toContain('<v>1200</v>')
  })
})

describe('reports', () => {
  const keys = monthRange(from, month)

  it('profit is revenue minus expenses minus teacher pay', () => {
    const rows = profitByMonth(data, keys)
    expect(rows).toHaveLength(6)
    for (const r of rows) expect(r.profit).toBe(r.revenue - r.expenses - r.teacherPay)
    expect(rows.some((r) => r.expenses > 0)).toBe(true)
  })

  it('retention counts leavers and their reasons', () => {
    const r = retention(data, from)
    expect(r.atStart).toBeGreaterThan(0)
    expect(r.reasons.reduce((s, x) => s + x.count, 0)).toBe(r.left)
    expect(r.rate).not.toBeNull()
    expect(r.rate!).toBeGreaterThan(0)
    expect(r.rate!).toBeLessThanOrEqual(1)
  })

  it('rankings are sorted and only include students with results', () => {
    const students = studentRanking(data, from)
    expect(students.length).toBeGreaterThan(0)
    for (let i = 1; i < students.length; i++) expect(students[i - 1].score!).toBeGreaterThanOrEqual(students[i].score!)
    expect(students.every((s) => s.score! >= 0 && s.score! <= 100)).toBe(true)
    const groups = groupRanking(data, from)
    expect(groups.length).toBe(data.groups.filter((g) => g.status === 'active').length)
  })

  it('teacher performance uses the salary rules', () => {
    const rows = teacherPerformance(data, from, month)
    const t9 = rows.find((r) => r.teacherId === 'tch_09')
    if (t9) expect(t9.pay).toBe(teacherSalary(data, 'tch_09', month).amount)
    expect(rows.every((r) => r.attendance === null || (r.attendance >= 0 && r.attendance <= 1))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { branchSeatHolder, type AttendanceRecord, type SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { userFromProfile } from './auth'
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
    expect(data.users.some((u) => (u.role as string) === 'reception')).toBe(false)
    expect(data.users.some((u) => u.role === 'accountant')).toBe(true)
  })

  it('upgrades version 6 data without losing anything', () => {
    const v6 = JSON.parse(JSON.stringify({ ...data, version: 6 })) as Record<string, unknown>
    for (const key of ['catalogs', 'extraLessons', 'expenses', 'salaryPayments', 'staffAttendance', 'contactLogs']) delete v6[key]
    v6.users = data.users.filter((u) => u.role !== 'accountant')
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
  it('the administrator runs the front desk; the accountant sees only money sections', () => {
    expect(can('admin', 'leads')).toBe(true)
    expect(can('admin', 'staffAttendance')).toBe(true)
    expect(can('accountant', 'expenses')).toBe(true)
    expect(can('accountant', 'leads')).toBe(false)
    expect(canOpen('accountant', '/payments/pay_1/receipt')).toBe(true)
    expect(canOpen('accountant', '/attendance')).toBe(false)
    expect(sectionForPath('/staff-attendance')).toBe('staffAttendance')
    expect(sectionForPath('/students/stu_001')).toBe('students')
  })

  it('a signed-in account becomes the matching person in the app, with the server’s role and branch', () => {
    const profile = { user_id: 'u1', center_id: 'ctr_sherov', branch_id: 'br_quyliq', role: 'accountant' as const, username: 'accountant.quyliq', full_name: 'Quyliq Accountant', app_user_id: 'usr_accountant_quyliq', teacher_id: null, active: true }
    const user = userFromProfile(profile, data.users)
    expect(user).toMatchObject({ id: 'usr_accountant_quyliq', role: 'accountant', branchId: 'br_quyliq', fullName: 'Quyliq Accountant', username: 'accountant.quyliq' })
    // The server decides the role, even if the app's own list says otherwise.
    const sneaky = userFromProfile({ ...profile, app_user_id: 'usr_owner' }, data.users)
    expect(sneaky.role).toBe('accountant')
    expect(sneaky.branchId).toBe('br_quyliq')
  })

  it('has one owner, and one administrator and one accountant per branch', () => {
    expect(data.users.filter((u) => u.role === 'owner')).toHaveLength(1)
    for (const b of data.branches) {
      expect(data.users.filter((u) => u.role === 'admin' && u.branchId === b.id && u.active !== false)).toHaveLength(1)
      expect(data.users.filter((u) => u.role === 'accountant' && u.branchId === b.id && u.active !== false)).toHaveLength(1)
    }
    const admin = data.users.find((u) => u.role === 'admin')!
    expect(branchSeatHolder(data.users, 'admin', admin.branchId)?.id).toBe(admin.id)
    expect(branchSeatHolder(data.users, 'admin', admin.branchId, admin.id)).toBeUndefined()
    expect(branchSeatHolder(data.users, 'teacher', admin.branchId)).toBeUndefined()
  })

  it('upgrades version 8 data: receptionists go, their records move to the branch administrator', () => {
    const v8 = JSON.parse(JSON.stringify({ ...data, version: 8 })) as SchoolData & { version: number }
    const rec = { id: 'usr_reception_bashlik', role: 'reception', fullName: 'Shahnoza Rasulova', username: 'reception.bashlik', branchId: 'br_bashlik', active: true }
    ;(v8.users as unknown[]).push(rec)
    v8.staffAttendance = v8.staffAttendance.map((r, i) => (i === 0 ? { ...r, recordedBy: rec.id } : r))
    v8.notificationReads = { ...v8.notificationReads, [rec.id]: ['n_x'] }
    const up = migrate(v8 as unknown as Record<string, unknown>, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(up)).toBeNull()
    expect(up.users.some((u) => u.id === rec.id)).toBe(false)
    expect(up.staffAttendance[0].recordedBy).toBe('usr_admin_bashlik')
    expect(up.notificationReads['usr_admin_bashlik']).toContain('n_x')
    expect(up.students).toHaveLength(data.students.length)
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

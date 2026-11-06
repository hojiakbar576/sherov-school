import { describe, expect, it } from 'vitest'
import type { SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { ROLE_HOME, ROLE_LOGIN, signsInOnOwnerPage } from './auth'
import { loginEmail } from './supabase'
import { branchData, branchSummaries, organisationTotals, revenueByBranch } from './owner'
import { computeBalances, outstandingTotal, revenueInMonth } from './metrics'
import { scopeData } from './scope'
import { monthKey } from './dates'

const NOW = new Date(2026, 10, 4, 16, 0) // Wed 4 Nov 2026
const data = createDemoData(NOW)

describe('owner sign-in', () => {
  it('the owner signs in on their own page; staff on the main one', () => {
    expect(signsInOnOwnerPage('owner')).toBe(true)
    for (const role of ['admin', 'accountant', 'teacher'] as const) expect(signsInOnOwnerPage(role)).toBe(false)
    expect(ROLE_HOME.owner).toBe('/owner')
    expect(ROLE_LOGIN.owner).toBe('/owner/login')
  })

  it('turns a username into the account’s private sign-in address', () => {
    expect(loginEmail(' Admin.Chilonzor ')).toBe('admin.chilonzor@users.sherov-crm.app')
  })

  it('doesn’t take a teacher’s username', () => {
    expect(data.users.find((u) => u.username === 'sherzod')?.role).toBe('teacher')
  })
})

describe('branch numbers for the owner', () => {
  const rows = branchSummaries(data, NOW)
  const totals = organisationTotals(data, rows, NOW)

  it('shows each branch exactly what its administrator sees', () => {
    for (const r of rows) {
      const admin = data.users.find((u) => u.role === 'admin' && u.branchId === r.branch.id)!
      const adminView = scopeData(data, admin)
      expect(branchData(data, r.branch.id).students.map((s) => s.id)).toEqual(adminView.students.map((s) => s.id))
      expect(r.activeStudents).toBe(adminView.students.filter((s) => s.status === 'active').length)
      expect(r.revenueThisMonth).toBe(revenueInMonth(adminView, monthKey(NOW)).total)
      expect(r.overdue).toBe(outstandingTotal(computeBalances(adminView, NOW)).overdueTotal)
      expect(r.adminName).toBe(admin.fullName)
    }
  })

  it('adds up to the whole school', () => {
    expect(totals.activeStudents).toBe(data.students.filter((s) => s.status === 'active').length)
    expect(totals.revenueThisMonth).toBe(revenueInMonth(data, monthKey(NOW)).total)
    expect(totals.runningGroups).toBe(data.groups.filter((g) => g.status === 'active').length)
  })

  it('splits six months of revenue by branch without losing any', () => {
    const months = revenueByBranch(data, NOW, 6)
    expect(months).toHaveLength(6)
    for (const m of months) {
      expect(Object.values(m.byBranch).reduce((a, b) => a + b, 0)).toBe(m.total)
      expect(m.total).toBe(revenueInMonth(data, m.month).total)
    }
  })
})

describe('upgrading version 5 data', () => {
  it('adds an empty bonus list and keeps everything else', () => {
    const v5 = JSON.parse(JSON.stringify({ ...data, version: 5 })) as Record<string, unknown>
    delete v5.bonuses
    const up = migrate(v5, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(up)).toBeNull()
    expect(up.bonuses).toEqual([])
    expect(up.students).toHaveLength(data.students.length)
  })
})

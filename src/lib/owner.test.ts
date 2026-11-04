import { describe, expect, it } from 'vitest'
import type { SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { DEMO_PASSWORD, demoSignIn, OWNER_DEMO_CREDENTIALS, ownerSignIn, ROLE_HOME } from './auth'
import { branchData, branchSummaries, organisationTotals, revenueByBranch } from './owner'
import { computeBalances, outstandingTotal, revenueInMonth } from './metrics'
import { scopeData } from './scope'
import { monthKey } from './dates'

const NOW = new Date(2026, 10, 4, 16, 0) // Wed 4 Nov 2026
const data = createDemoData(NOW)

describe('owner sign-in', () => {
  it('accepts only the owner credentials, and only on the owner sign-in', () => {
    const owner = ownerSignIn(data.users, OWNER_DEMO_CREDENTIALS.username, OWNER_DEMO_CREDENTIALS.password)
    expect(owner?.role).toBe('owner')
    expect(ownerSignIn(data.users, OWNER_DEMO_CREDENTIALS.username, 'wrong')).toBeNull()
    expect(ownerSignIn(data.users, 'admin.chilonzor', DEMO_PASSWORD)).toBeNull()
    // The shared demo sign-in never lets the owner in.
    expect(demoSignIn(data.users, OWNER_DEMO_CREDENTIALS.username, OWNER_DEMO_CREDENTIALS.password)).toBeNull()
    expect(demoSignIn(data.users, 'owner', DEMO_PASSWORD)).toBeNull()
    expect(ROLE_HOME.owner).toBe('/owner')
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

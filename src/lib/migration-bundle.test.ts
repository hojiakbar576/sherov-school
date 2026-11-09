import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data/seed'
import { applyBundle, parseBundle, summarizeBundle, type MigrationBundle } from './migration-bundle'

const d = createDemoData(new Date('2026-11-08T09:00:00'))
const s0 = d.students.find((s) => s.branchId === 'br_bashlik')!
const p0 = d.payments[0]
const bundle: MigrationBundle = {
  kind: 'sherov-migration', version: 1, branchId: 'br_bashlik', title: 'test',
  upserts: { students: [{ ...s0, id: 'stu_new', fullName: 'New Person' }], payments: [{ ...p0, amount: 1 }] },
  patches: { students: [{ id: s0.id, lcupIds: ['123'] }, { id: 'nobody', lcupIds: ['9'] }] },
  deletes: { payments: [d.payments[1].id, 'gone'] },
}

describe('prepared migration files', () => {
  it('adds, replaces, updates and removes exactly what the file says', () => {
    const next = applyBundle(d, bundle)
    expect(next.students).toHaveLength(d.students.length + 1)
    expect(next.students.find((s) => s.id === s0.id)).toMatchObject({ fullName: s0.fullName, lcupIds: ['123'] })
    expect(next.payments.find((p) => p.id === p0.id)!.amount).toBe(1)
    expect(next.payments.some((p) => p.id === d.payments[1].id)).toBe(false)
    expect(next.payments).toHaveLength(d.payments.length - 1)
    expect(next.teachers).toBe(d.teachers) // untouched collections stay the same
  })

  it('applying it twice gives the same result', () => {
    const once = applyBundle(d, bundle)
    expect(applyBundle(once, bundle)).toEqual(once)
  })

  it('reports what would happen, including records it cannot find', () => {
    const s = summarizeBundle(d, bundle)
    expect(s.rows.find((r) => r.collection === 'students')).toMatchObject({ add: 1, replace: 0, update: 1 })
    expect(s.rows.find((r) => r.collection === 'payments')).toMatchObject({ replace: 1, remove: 1 })
    expect(s.missingForPatch).toEqual(['students: nobody'])
    expect(s.missingForDelete).toEqual(['payments: gone'])
  })

  it('flags records for another branch', () => {
    const other = { ...bundle, upserts: { students: [{ ...s0, id: 'x', branchId: 'br_chilonzor' }] } }
    expect(summarizeBundle(d, other).wrongBranch).toEqual(['students: x'])
  })

  it('refuses files that are not migration files', () => {
    expect(() => parseBundle('{"a":1}')).toThrow()
    expect(() => parseBundle(JSON.stringify({ ...bundle, upserts: { hackers: [] } }))).toThrow()
    expect(parseBundle(JSON.stringify(bundle)).title).toBe('test')
  })
})

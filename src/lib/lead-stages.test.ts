import { describe, expect, it } from 'vitest'
import type { SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { scopeData } from './scope'
import {
  defaultLeadStages,
  deleteStage,
  leadStagesProblem,
  openStages,
  orderedStages,
  stageName,
  stageNameProblem,
  withStageAdded,
  withStageMoved,
} from './lead-stages'

const NOW = new Date(2026, 10, 5, 12, 0)
const data = createDemoData(NOW)
const custom = { id: 'stage_test', name: 'Placement test booked', color: 'info' as const }

describe('default stages', () => {
  it('are the six built-in stages, in board order', () => {
    expect(data.version).toBe(DATA_VERSION)
    expect(orderedStages(data.leadStages).map((s) => s.id)).toEqual(['new', 'contacted', 'trial_scheduled', 'trial_done', 'enrolled', 'lost'])
    expect(stageName(data.leadStages, 'trial_done')).toBe('Trial completed')
    expect(validateSchoolData(data)).toBeNull()
  })

  it('are the same for every branch', () => {
    const admin = data.users.find((u) => u.username === 'admin.bashlik')!
    expect(scopeData(data, admin).leadStages).toEqual(data.leadStages)
  })

  it('come with version 7 data upgraded, keeping every enquiry’s stage', () => {
    const v7 = JSON.parse(JSON.stringify({ ...data, version: 7 })) as Record<string, unknown>
    delete v7.leadStages
    const up = migrate(v7, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(up)).toBeNull()
    expect(up.leadStages).toEqual(defaultLeadStages())
    expect(up.leads.map((l) => l.stage)).toEqual(data.leads.map((l) => l.stage))
  })
})

describe('changing stages', () => {
  it('adds a stage before Enrolled and keeps closed stages last', () => {
    const next = withStageAdded(data.leadStages, custom)
    expect(next.map((s) => s.id)).toEqual(['new', 'contacted', 'trial_scheduled', 'trial_done', 'stage_test', 'enrolled', 'lost'])
  })

  it('reorders open stages only', () => {
    const added = withStageAdded(data.leadStages, custom)
    const left = withStageMoved(added, 'stage_test', -1)
    expect(left.map((s) => s.id).slice(0, 5)).toEqual(['new', 'contacted', 'trial_scheduled', 'stage_test', 'trial_done'])
    // Can't move past the edges, and Enrolled / Lost don't move.
    expect(withStageMoved(left, 'new', -1).map((s) => s.id)).toEqual(left.map((s) => s.id))
    expect(withStageMoved(left, 'enrolled', -1).map((s) => s.id)).toEqual(left.map((s) => s.id))
    expect(withStageMoved(added, 'stage_test', 1).map((s) => s.id).slice(-2)).toEqual(['enrolled', 'lost'])
  })

  it('checks names', () => {
    expect(stageNameProblem(data.leadStages, ' ')).not.toBeNull()
    expect(stageNameProblem(data.leadStages, 'contacted')).not.toBeNull() // same as a built-in, any case
    expect(stageNameProblem(data.leadStages, 'Contacted', 'contacted')).toBeNull() // its own name
    expect(stageNameProblem(data.leadStages, 'x'.repeat(31))).not.toBeNull()
    expect(stageNameProblem(data.leadStages, 'Waiting for parents')).toBeNull()
  })
})

describe('deleting a stage', () => {
  const withCustom = (): SchoolData => {
    const leads = data.leads.map((l, i) => (i < 3 ? { ...l, stage: 'stage_test' } : l))
    return { ...data, leadStages: withStageAdded(data.leadStages, custom), leads }
  }

  it('never deletes built-in stages', () => {
    const r = deleteStage(data, 'contacted', 'new')
    expect(r.ok).toBe(false)
  })

  it('refuses while enquiries are in it and nowhere to move them', () => {
    const d = withCustom()
    expect(deleteStage(d, 'stage_test').ok).toBe(false)
    expect(deleteStage(d, 'stage_test', 'stage_test').ok).toBe(false)
    expect(deleteStage(d, 'stage_test', 'enrolled').ok).toBe(false) // enrolling needs a student record
    expect(deleteStage(d, 'stage_test', 'missing').ok).toBe(false)
  })

  it('moves every enquiry (all branches) and loses none', () => {
    const d = withCustom()
    const inside = d.leads.filter((l) => l.stage === 'stage_test')
    expect(new Set(inside.map((l) => l.branchId)).size).toBeGreaterThan(0)
    const r = deleteStage(d, 'stage_test', 'contacted')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.moved).toBe(3)
    expect(r.data.leads).toHaveLength(d.leads.length)
    for (const l of inside) {
      const after = r.data.leads.find((x) => x.id === l.id)!
      expect(after.stage).toBe('contacted')
      expect({ ...after, stage: l.stage, updatedAt: l.updatedAt }).toEqual(l) // nothing else changed
    }
    expect(r.data.leadStages.some((s) => s.id === 'stage_test')).toBe(false)
    expect(leadStagesProblem(r.data.leadStages, r.data.leads)).toBeNull()
  })

  it('deletes an empty stage straight away', () => {
    const d = { ...data, leadStages: withStageAdded(data.leadStages, custom) }
    const r = deleteStage(d, 'stage_test')
    expect(r.ok && r.moved === 0 && openStages(r.data.leadStages).length === 4).toBe(true)
  })

  it('saved data with an enquiry in an unknown stage is rejected, not silently changed', () => {
    const broken = { ...data, leads: data.leads.map((l, i) => (i === 0 ? { ...l, stage: 'gone' } : l)) }
    expect(validateSchoolData(broken)).toMatch(/unknown stage/)
  })
})

// The admissions board's stages: one list, managed by the owner and shared by
// every branch. Everything that shows or changes stages goes through here, so
// no component keeps its own copy of the stage list.
//
// Pure functions over plain data, so the same rules can move to the database
// later (a lead_stages table with position, and a check that a stage with
// leads can't be dropped without moving them).

import type { Lead, LeadStage, LeadStageColor, LeadStageDef, SchoolData, SystemLeadStage } from '../types'
import { LEAD_STAGES } from '../types'
import { tr } from '../i18n'

/** Default names of the built-in stages (translated when shown). */
export const SYSTEM_STAGE_NAME: Record<SystemLeadStage, string> = {
  new: 'New enquiry',
  contacted: 'Contacted',
  trial_scheduled: 'Trial scheduled',
  trial_done: 'Trial completed',
  enrolled: 'Enrolled',
  lost: 'Lost',
}

const DEFAULT_COLOR: Record<SystemLeadStage, LeadStageColor> = {
  new: 'accent',
  contacted: 'neutral',
  trial_scheduled: 'info',
  trial_done: 'brand',
  enrolled: 'success',
  lost: 'neutral',
}

/** Closed stages: always the last two columns, in this order. */
export const CLOSED_STAGES: readonly LeadStage[] = ['enrolled', 'lost']

export const STAGE_NAME_MAX = 30

export function defaultLeadStages(): LeadStageDef[] {
  return LEAD_STAGES.map((id) => ({ id, color: DEFAULT_COLOR[id] }))
}

export function isSystemStage(id: LeadStage): id is SystemLeadStage {
  return (LEAD_STAGES as readonly string[]).includes(id)
}

/** The name to show for a stage. Unknown ids show as themselves rather than disappearing. */
export function stageName(stages: LeadStageDef[], id: LeadStage): string {
  const def = stages.find((s) => s.id === id)
  if (def?.name) return def.name
  return isSystemStage(id) ? tr(SYSTEM_STAGE_NAME[id]) : id
}

export function stageColor(stages: LeadStageDef[], id: LeadStage): LeadStageColor {
  return stages.find((s) => s.id === id)?.color ?? 'neutral'
}

/** Board order: the open stages as the owner arranged them, then Enrolled, then Lost. */
export function orderedStages(stages: LeadStageDef[]): LeadStageDef[] {
  const open = stages.filter((s) => !CLOSED_STAGES.includes(s.id))
  const closed = CLOSED_STAGES.flatMap((id) => stages.filter((s) => s.id === id))
  return [...open, ...closed]
}

/** Stages an enquiry is still being worked on in (everything except Enrolled and Lost). */
export function openStages(stages: LeadStageDef[]): LeadStageDef[] {
  return orderedStages(stages).filter((s) => !CLOSED_STAGES.includes(s.id))
}

/** How many enquiries sit in each stage (all the enquiries passed in). */
export function stageCounts(leads: Lead[]): Map<LeadStage, number> {
  const counts = new Map<LeadStage, number>()
  for (const l of leads) counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1)
  return counts
}

/** A problem with a proposed stage name, or null when it's fine. */
export function stageNameProblem(stages: LeadStageDef[], name: string, exceptId?: LeadStage): string | null {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (clean.length < 2) return tr('Give the stage a name of at least 2 letters.')
  if (clean.length > STAGE_NAME_MAX) return tr('Keep the name under {0} characters.', STAGE_NAME_MAX)
  const taken = stages.some((s) => s.id !== exceptId && stageName(stages, s.id).toLowerCase() === clean.toLowerCase())
  return taken ? tr('There is already a stage with this name.') : null
}

/** Adds an open stage just before Enrolled. */
export function withStageAdded(stages: LeadStageDef[], stage: LeadStageDef): LeadStageDef[] {
  const ordered = orderedStages(stages)
  const at = ordered.findIndex((s) => CLOSED_STAGES.includes(s.id))
  return at === -1 ? [...ordered, stage] : [...ordered.slice(0, at), stage, ...ordered.slice(at)]
}

/** Moves an open stage one place left (-1) or right (+1). Closed stages don't move. */
export function withStageMoved(stages: LeadStageDef[], id: LeadStage, direction: -1 | 1): LeadStageDef[] {
  const open = openStages(stages)
  const i = open.findIndex((s) => s.id === id)
  const j = i + direction
  if (i === -1 || j < 0 || j >= open.length) return orderedStages(stages)
  const next = [...open]
  ;[next[i], next[j]] = [next[j], next[i]]
  return [...next, ...orderedStages(stages).filter((s) => CLOSED_STAGES.includes(s.id))]
}

export type DeleteStageResult = { ok: true; data: SchoolData; moved: number } | { ok: false; reason: string }

/**
 * Removes a stage the owner added. Enquiries in it (in every branch) are moved
 * to `moveTo` first; with enquiries in it and no valid `moveTo`, nothing
 * changes. Built-in stages can't be removed.
 */
export function deleteStage(data: SchoolData, id: LeadStage, moveTo?: LeadStage): DeleteStageResult {
  if (!data.leadStages.some((s) => s.id === id)) return { ok: false, reason: tr('That stage no longer exists.') }
  if (isSystemStage(id)) return { ok: false, reason: tr('Built-in stages can be renamed or moved, but not deleted.') }
  const inside = data.leads.filter((l) => l.stage === id)
  if (inside.length > 0) {
    const target = openStages(data.leadStages).find((s) => s.id === moveTo && s.id !== id)
    if (!target) return { ok: false, reason: tr('Choose where its {0} enquiries should go first.', inside.length) }
  }
  const now = new Date().toISOString()
  return {
    ok: true,
    moved: inside.length,
    data: {
      ...data,
      leads: inside.length ? data.leads.map((l) => (l.stage === id ? { ...l, stage: moveTo!, updatedAt: now } : l)) : data.leads,
      leadStages: data.leadStages.filter((s) => s.id !== id),
    },
  }
}

/** Problems with a saved stage list, or null. Used when loading saved data. */
export function leadStagesProblem(stages: LeadStageDef[], leads: Lead[]): string | null {
  const ids = new Set(stages.map((s) => s.id))
  if (ids.size !== stages.length) return 'lead stages repeat'
  const missing = LEAD_STAGES.find((id) => !ids.has(id))
  if (missing) return `the built-in lead stage "${missing}" is missing`
  const stray = leads.find((l) => !ids.has(l.stage))
  return stray ? `an enquiry is in an unknown stage ("${stray.stage}")` : null
}

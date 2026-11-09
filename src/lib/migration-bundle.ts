// A prepared migration file: records checked outside the app (from LC UP) and
// applied in one step by the owner. The file says exactly what to add, update
// and remove, so the app never has to guess. Applying it twice changes nothing.

import type { SchoolData } from '../types'
import { LIST_COLLECTIONS, type ListCollection } from '../data/cloud'

export interface MigrationBundle {
  kind: 'sherov-migration'
  version: 1
  /** The branch the file is for, e.g. "br_bashlik". */
  branchId: string
  /** A short description shown before applying, e.g. "LC UP Bashliq: payment history". */
  title: string
  /** Records to add or replace, by collection. */
  upserts: Partial<Record<ListCollection, ({ id: string } & Record<string, unknown>)[]>>
  /** Fields to set on existing records (records missing from the app are reported, not created). */
  patches?: Partial<Record<ListCollection, ({ id: string } & Record<string, unknown>)[]>>
  /** Records to remove, by collection. */
  deletes?: Partial<Record<ListCollection, string[]>>
  /** Totals to show and check before applying. */
  checks?: Record<string, string | number>
}

export interface BundleSummary {
  rows: { collection: string; add: number; replace: number; update: number; remove: number }[]
  missingForPatch: string[]
  missingForDelete: string[]
  /** Records that would land in a different branch than the file says. */
  wrongBranch: string[]
}

const isList = (c: string): c is ListCollection => (LIST_COLLECTIONS as readonly string[]).includes(c)

/** Reads and checks a migration file. Throws a readable message when it is not one. */
export function parseBundle(text: string): MigrationBundle {
  let b: MigrationBundle
  try {
    b = JSON.parse(text)
  } catch {
    throw new Error('This is not a migration file.')
  }
  if (b?.kind !== 'sherov-migration' || b.version !== 1 || typeof b.branchId !== 'string' || typeof b.upserts !== 'object') throw new Error('This is not a migration file.')
  for (const part of [b.upserts, b.patches ?? {}, b.deletes ?? {}]) {
    for (const [c, items] of Object.entries(part)) {
      if (!isList(c)) throw new Error(`Unknown kind of record in the file: ${c}`)
      if (!Array.isArray(items)) throw new Error(`Broken list in the file: ${c}`)
    }
  }
  return b
}

/** What applying the file would do, without doing it. */
export function summarizeBundle(d: SchoolData, b: MigrationBundle): BundleSummary {
  const collections = new Set([...Object.keys(b.upserts), ...Object.keys(b.patches ?? {}), ...Object.keys(b.deletes ?? {})]) as Set<ListCollection>
  const rows: BundleSummary['rows'] = []
  const missingForPatch: string[] = []
  const missingForDelete: string[] = []
  const wrongBranch: string[] = []
  for (const c of collections) {
    const have = new Set((d[c] as { id: string }[]).map((x) => x.id))
    const up = b.upserts[c] ?? []
    const patch = b.patches?.[c] ?? []
    const del = b.deletes?.[c] ?? []
    for (const p of patch) if (!have.has(p.id)) missingForPatch.push(`${c}: ${p.id}`)
    for (const id of del) if (!have.has(id)) missingForDelete.push(`${c}: ${id}`)
    for (const x of up as { id: string; branchId?: string }[]) if (x.branchId && x.branchId !== b.branchId) wrongBranch.push(`${c}: ${x.id}`)
    rows.push({
      collection: c,
      add: up.filter((x) => !have.has(x.id)).length,
      replace: up.filter((x) => have.has(x.id)).length,
      update: patch.filter((p) => have.has(p.id)).length,
      remove: del.filter((id) => have.has(id)).length,
    })
  }
  return { rows, missingForPatch, missingForDelete, wrongBranch }
}

/** The data after applying the file: removals first, then additions/replacements, then field updates. */
export function applyBundle(d: SchoolData, b: MigrationBundle): SchoolData {
  const next = { ...d } as Record<string, unknown>
  const collections = new Set([...Object.keys(b.upserts), ...Object.keys(b.patches ?? {}), ...Object.keys(b.deletes ?? {})]) as Set<ListCollection>
  for (const c of collections) {
    const remove = new Set(b.deletes?.[c] ?? [])
    const up = new Map((b.upserts[c] ?? []).map((x) => [x.id, x]))
    const patch = new Map((b.patches?.[c] ?? []).map((p) => [p.id, p]))
    const list = (d[c] as { id: string }[]).filter((x) => !remove.has(x.id))
    const seen = new Set<string>()
    let out = list.map((x) => {
      seen.add(x.id)
      return up.get(x.id) ?? x
    })
    out = [...out, ...[...up.values()].filter((x) => !seen.has(x.id))]
    out = out.map((x) => (patch.has(x.id) ? { ...x, ...patch.get(x.id), id: x.id } : x))
    next[c] = out
  }
  return next as unknown as SchoolData
}

// Reading and writing the `records` table. Kept apart from cloud.ts so the
// row logic can be tested without a database.

import { supabase } from '../lib/supabase'
import { ACTIVITY_LOADED, APPEND_ONLY, type Changes, type CloudRow } from './cloud'

const PAGE = 1000
const BATCH = 400
const COLUMNS = 'collection, id, branch_id, person_id, data'

/** Every row this person may see (the database's rules decide), plus the branch list. */
export async function loadRows(centerId: string): Promise<{ rows: CloudRow[]; branches: { id: string; name: string }[] }> {
  const rows: CloudRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('records')
      .select(COLUMNS)
      .eq('center_id', centerId)
      .neq('collection', 'activity')
      .order('collection')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data as CloudRow[]))
    if (data.length < PAGE) break
  }
  // Only the newest activity entries; the full history stays in the database.
  const activity = await supabase
    .from('records')
    .select(COLUMNS)
    .eq('center_id', centerId)
    .eq('collection', 'activity')
    .order('updated_at', { ascending: false })
    .limit(ACTIVITY_LOADED)
  if (activity.error) throw new Error(activity.error.message)
  rows.push(...(activity.data as CloudRow[]))

  const branches = await supabase.from('branches').select('id, name').eq('center_id', centerId).order('name')
  if (branches.error) throw new Error(branches.error.message)
  return { rows, branches: branches.data }
}

/** Sends changes. Throws if the database refuses any of them, so nothing is marked saved by mistake. */
export async function saveChanges(centerId: string, changes: Changes): Promise<void> {
  const withCentre = (r: CloudRow) => ({ center_id: centerId, ...r })
  const append = changes.upserts.filter((r) => APPEND_ONLY.has(r.collection))
  const normal = changes.upserts.filter((r) => !APPEND_ONLY.has(r.collection))
  for (let i = 0; i < normal.length; i += BATCH) {
    const { error } = await supabase.from('records').upsert(normal.slice(i, i + BATCH).map(withCentre), { onConflict: 'center_id,collection,id' })
    if (error) throw new Error(error.message)
  }
  for (let i = 0; i < append.length; i += BATCH) {
    const { error } = await supabase
      .from('records')
      .upsert(append.slice(i, i + BATCH).map(withCentre), { onConflict: 'center_id,collection,id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }
  // Deletes grouped by collection.
  const byCollection = new Map<string, string[]>()
  for (const d of changes.deletes) byCollection.set(d.collection, [...(byCollection.get(d.collection) ?? []), d.id])
  for (const [collection, ids] of byCollection) {
    for (let i = 0; i < ids.length; i += BATCH) {
      const { error } = await supabase.from('records').delete().eq('center_id', centerId).eq('collection', collection).in('id', ids.slice(i, i + BATCH))
      if (error) throw new Error(error.message)
    }
  }
}

/** Live updates when someone else changes something. Returns a function that stops listening. */
export function listenForChanges(
  centerId: string,
  onRow: (row: CloudRow) => void,
  onRemove: (r: { collection: string; id: string }) => void,
): () => void {
  const channel = supabase
    .channel(`records:${centerId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `center_id=eq.${centerId}` }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const old = payload.old as Partial<CloudRow>
        if (old.collection && old.id) onRemove({ collection: old.collection, id: old.id })
      } else {
        const r = payload.new as CloudRow
        onRow({ collection: r.collection, id: r.id, branch_id: r.branch_id, person_id: r.person_id, data: r.data })
      }
    })
    .subscribe()
  return () => void supabase.removeChannel(channel)
}

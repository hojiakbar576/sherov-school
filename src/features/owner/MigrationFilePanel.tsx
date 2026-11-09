import { useState } from 'react'
import { AlertTriangle, FileCheck2, Upload } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { parseBundle, summarizeBundle, type MigrationBundle } from '../../lib/migration-bundle'
import { formatNumber } from '../../lib/format'
import { tr } from '../../i18n'

/** Owner only: applies a migration file prepared and checked outside the app. */
export function MigrationFilePanel() {
  const { owner, actions, saving } = useSchool()
  const toast = useToast()
  const data = owner!.data
  const [bundle, setBundle] = useState<MigrationBundle | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [applied, setApplied] = useState(false)

  async function read(file: File | undefined) {
    if (!file) return
    setProblem(null)
    setApplied(false)
    try {
      setBundle(parseBundle(await file.text()))
    } catch (e) {
      setBundle(null)
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }

  const summary = bundle ? summarizeBundle(data, bundle) : null
  const branch = bundle ? data.branches.find((b) => b.id === bundle.branchId) : null
  const blocked = !!summary && (summary.wrongBranch.length > 0 || !branch)
  const total = summary?.rows.reduce((s, r) => s + r.add + r.replace + r.update + r.remove, 0) ?? 0

  return (
    <Panel title={tr("Prepared migration file")} description={tr("For a file prepared and checked by your developer (.json). It shows exactly what it will add, change and remove before anything is saved.")} className="mt-6">
      <div className="space-y-4 text-sm">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-line px-4 py-5 text-ink-muted hover:bg-subtle">
          <Upload aria-hidden className="size-4" />
          {tr("Choose the migration file")}
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => (read(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        {problem && <p className="text-danger">{problem}</p>}
        {bundle && summary && (
          <>
            <p className="font-medium text-ink">
              {bundle.title} · {branch?.name ?? bundle.branchId}
            </p>
            {bundle.checks && (
              <dl className="divide-y divide-line rounded-control border border-line px-3">
                {Object.entries(bundle.checks).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-1.5">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="num text-right font-medium">{typeof v === 'number' ? formatNumber(v) : v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <table className="w-full text-left">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="py-1">{tr("Records")}</th>
                  <th className="py-1 text-right">{tr("New")}</th>
                  <th className="py-1 text-right">{tr("Replaced")}</th>
                  <th className="py-1 text-right">{tr("Updated")}</th>
                  <th className="py-1 text-right">{tr("Removed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.rows.map((r) => (
                  <tr key={r.collection}>
                    <td className="py-1.5">{r.collection}</td>
                    {[r.add, r.replace, r.update, r.remove].map((n, i) => (
                      <td key={i} className="num py-1.5 text-right">
                        {n ? formatNumber(n) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {[
              [tr("Records to update that are not in the CRM (skipped)"), summary.missingForPatch],
              [tr("Records to remove that are already gone"), summary.missingForDelete],
              [tr("Records for a different branch (the file can't be applied)"), summary.wrongBranch],
            ].map(([label, items]) =>
              (items as string[]).length ? (
                <p key={label as string} className="flex gap-2 text-warning">
                  <AlertTriangle aria-hidden className="size-4 shrink-0" />
                  {label as string}: {(items as string[]).length}
                </p>
              ) : null,
            )}
            {applied ? (
              <p className="flex items-center gap-2 font-medium text-success">
                <FileCheck2 aria-hidden className="size-4" />
                {saving ? tr("Applied. Saving to the database… keep this page open.") : tr("Applied and saved.")}
              </p>
            ) : (
              <Button disabled={blocked || total === 0} onClick={() => setConfirm(true)}>
                {tr("Apply {0} changes", formatNumber(total))}
              </Button>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm && !!bundle}
        title={tr("Apply this migration file?")}
        confirmLabel={tr("Apply")}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          actions.applyMigration(bundle!)
          setApplied(true)
          toast.show(tr("Saving the changes. Keep this page open until it says saved."))
        }}
      >
        <p>{tr("The changes listed are made for {0} only. Old versions are kept, so this can be undone if something is wrong.", branch?.name ?? '')}</p>
      </ConfirmDialog>
    </Panel>
  )
}

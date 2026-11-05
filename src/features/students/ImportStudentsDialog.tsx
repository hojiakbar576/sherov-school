import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { AlertCircle, CheckCircle2, Copy, Download, FileSpreadsheet, Info, Upload } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { TableScroll, td, th } from '../../components/ui/misc'
import { useToast } from '../../components/ui/toast-context'
import { readSpreadsheet } from '../../lib/xlsx-read'
import { downloadXlsx } from '../../lib/xlsx'
import { importTemplate, planImport, type ImportPlan } from '../../lib/student-import'
import { toISODate } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { plural, tr } from '../../i18n'

type Show = 'all' | 'ready' | 'problems' | 'duplicates'

/**
 * Import students from Excel in three steps: get the template, choose the
 * file, check the preview. Nothing is saved until "Import" is pressed, and
 * only rows without problems are added.
 */
export function ImportStudentsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={tr("Import students from Excel")} description={tr("Nothing is saved until you check the preview and press Import.")} size="lg">
      {open && <ImportBody onClose={onClose} />}
    </Dialog>
  )
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const { data, now, actions, owner, user } = useSchool()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [show, setShow] = useState<Show>('all')
  const [error, setError] = useState<string | null>(null)

  const fallbackBranch = user?.role === 'owner' ? (owner?.branchId ?? null) : (user?.branchId ?? null)
  const example = data.groups.find((g) => g.status === 'active')

  const choose = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setPlan(null)
    setFileName(file.name)
    setReading(true)
    try {
      const sheet = await readSpreadsheet(file)
      const next = planImport(sheet, data, { today: toISODate(now), fallbackBranch })
      if (next.error) setError(next.error)
      else setPlan(next)
      setShow('all')
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("This file couldn’t be read."))
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void choose(e.dataTransfer.files[0])
  }

  const ready = plan?.rows.filter((r) => r.input) ?? []
  const problems = plan?.rows.filter((r) => !r.input && !r.duplicate) ?? []
  const duplicates = plan?.rows.filter((r) => r.duplicate) ?? []
  const visible = (plan?.rows ?? []).filter((r) => show === 'all' || (show === 'ready' ? r.input : show === 'duplicates' ? r.duplicate : !r.input && !r.duplicate))

  const save = () => {
    try {
      const added = actions.importStudents(ready.map((r) => r.input!))
      toast.show(tr("{0} {1} imported.", added.length, plural(added.length, 'student', 'students')))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-5">
      {/* Step 1 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-subtle px-4 py-3 text-sm">
        <p className="text-ink">
          <span className="font-medium">{tr("1. Get the template.")}</span> {tr("Fill in one student per row. Only Student and a phone are required; a group’s fee is used when Monthly tuition is empty.")}
        </p>
        <Button size="sm" onClick={() => downloadXlsx(`sherov-school-students-template.xlsx`, importTemplate(example), 'students')}>
          <Download aria-hidden />
          {tr("Download template")}
        </Button>
      </div>

      {/* Step 2 */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">{tr("2. Choose the file")}</p>
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed px-4 py-6 text-center text-sm transition-colors',
            dragging ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-brand hover:bg-subtle',
          )}
        >
          <Upload aria-hidden className="size-5 text-ink-muted" />
          <span className="font-medium text-ink">{reading ? tr("Reading…") : fileName ? tr("{0}. Choose another file", fileName) : tr("Choose an Excel or CSV file, or drop it here")}</span>
          <span className="text-xs text-ink-muted">{tr(".xlsx or .csv. A file exported from this page works too.")}</span>
          <input ref={input} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
        </label>
        {error && (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* Step 3 */}
      {plan && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">{tr("3. Check the preview")}</p>
          <div role="group" aria-label={tr("Show rows")} className="mb-3 flex flex-wrap gap-2 text-sm">
            <Chip active={show === 'all'} onClick={() => setShow('all')} label={tr("All rows ({0})", plan.rows.length)} />
            <Chip active={show === 'ready'} onClick={() => setShow('ready')} tone="success" label={tr("Ready ({0})", ready.length)} />
            <Chip active={show === 'problems'} onClick={() => setShow('problems')} tone="danger" label={tr("Need fixing ({0})", problems.length)} />
            <Chip active={show === 'duplicates'} onClick={() => setShow('duplicates')} label={tr("Already added ({0})", duplicates.length)} />
          </div>
          {plan.ignored.length > 0 && (
            <p className="mb-3 flex items-start gap-1.5 text-xs text-ink-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {tr("Not imported (calculated by the system): {0}.", plan.ignored.join(', '))}
            </p>
          )}
          {plan.rows.length === 0 ? (
            <p className="text-sm text-ink-muted">{tr("The file has headers but no students.")}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-control border border-line">
              <TableScroll>
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 bg-canvas">
                    <tr className="border-b border-line">
                      <th scope="col" className={cn(th, 'w-14')}>{tr("Row")}</th>
                      <th scope="col" className={th}>{tr("Student")}</th>
                      <th scope="col" className={th}>{tr("Group")}</th>
                      <th scope="col" className={th}>{tr("Result")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((r) => (
                      <tr key={r.row} className={cn(!r.input && !r.duplicate && 'bg-danger-soft/40')}>
                        <td className={cn(td, 'num text-ink-muted')}>{r.row}</td>
                        <td className={td}>
                          <p className="font-medium text-ink">{r.name || <span className="text-ink-faint">{tr("(no name)")}</span>}</p>
                          {r.phone && <p className="num text-xs whitespace-nowrap text-ink-muted">{r.phone}</p>}
                        </td>
                        <td className={cn(td, 'text-ink-muted')}>{r.groupName || '—'}</td>
                        <td className={td}>
                          {r.input ? (
                            <span className="inline-flex items-center gap-1 text-success">
                              <CheckCircle2 aria-hidden className="size-4" />
                              {tr("Ready")}
                            </span>
                          ) : r.duplicate ? (
                            <span className="inline-flex items-center gap-1 text-ink-muted">
                              <Copy aria-hidden className="size-4" />
                              {tr("Already in the system, skipped")}
                            </span>
                          ) : (
                            <ul className="space-y-0.5 text-danger">
                              {r.problems.map((p) => (
                                <li key={p} className="flex items-start gap-1">
                                  <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                                  {p}
                                </li>
                              ))}
                            </ul>
                          )}
                          {r.notes.map((n) => (
                            <p key={n} className="mt-0.5 text-xs text-warning">
                              {n}
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
          )}
          {problems.length > 0 && <p className="mt-2 text-xs text-ink-muted">{tr("Rows that need fixing are left out. Fix them in the file and import it again: students already added are skipped automatically.")}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <p className="mr-auto text-xs text-ink-muted">
          <Link to="/groups" className="hover:text-brand hover:underline">
            {tr("Group names must match the Groups page.")}
          </Link>
        </p>
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button variant="primary" onClick={save} disabled={ready.length === 0}>
          <FileSpreadsheet aria-hidden />
          {ready.length ? tr("Import {0} {1}", ready.length, plural(ready.length, 'student', 'students')) : tr("Import")}
        </Button>
      </div>
    </div>
  )
}

function Chip({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone?: 'success' | 'danger' }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 transition-colors',
        active ? 'border-brand bg-brand-soft font-medium text-brand-ink' : 'border-line text-ink-muted hover:text-ink',
        !active && tone === 'success' && 'text-success',
        !active && tone === 'danger' && 'text-danger',
      )}
    >
      {label}
    </button>
  )
}

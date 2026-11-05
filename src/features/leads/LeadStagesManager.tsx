import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Lock, Pencil, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import type { LeadStage, LeadStageColor, LeadStageDef } from '../../types'
import { LEAD_STAGE_COLORS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { toneDot } from '../../components/ui/tone'
import { CLOSED_STAGES, isSystemStage, openStages, orderedStages, STAGE_NAME_MAX, stageName, stageNameProblem } from '../../lib/lead-stages'
import { cn } from '../../lib/cn'
import { plural, tr } from '../../i18n'

const COLOR_NAME: Record<LeadStageColor, string> = {
  neutral: 'Grey',
  brand: 'Dark green',
  accent: 'Orange',
  info: 'Blue',
  success: 'Green',
  warning: 'Yellow',
  danger: 'Red',
}

function ColorSelect({ value, onChange, label, className, ...rest }: { value: LeadStageColor; onChange: (c: LeadStageColor) => void; label?: string; className?: string; id?: string; 'aria-describedby'?: string }) {
  return (
    <Select {...rest} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as LeadStageColor)} className={className}>
      {LEAD_STAGE_COLORS.map((c) => (
        <option key={c} value={c}>
          {tr(COLOR_NAME[c])}
        </option>
      ))}
    </Select>
  )
}

/** "Manage lead stages", opened from the admissions page. Owner only. */
export function LeadStagesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={tr("Manage lead stages")} description={tr("The columns of the admissions board, the same in every branch.")} size="lg">
      <LeadStagesManager />
    </Dialog>
  )
}

/**
 * The owner's editor for the admissions stages: add, rename, recolour,
 * reorder and delete. Enquiries are never lost: a stage with enquiries in it
 * (in any branch) can only be deleted after choosing where they move.
 */
export function LeadStagesManager() {
  const { owner, actions } = useSchool()
  const toast = useToast()
  const [renaming, setRenaming] = useState<{ id: LeadStage; name: string; error?: string } | null>(null)
  const [deleting, setDeleting] = useState<LeadStage | null>(null)
  const [draft, setDraft] = useState<{ name: string; color: LeadStageColor; error?: string }>({ name: '', color: 'info' })
  if (!owner) return null

  // Every branch's enquiries, not just the branch picked in the header.
  const all = owner.data
  const stages = orderedStages(all.leadStages)
  const open = openStages(all.leadStages)
  const count = (id: LeadStage) => all.leads.filter((l) => l.stage === id).length
  const branchNames = all.branches.map((b) => b.name).join(', ')

  const add = (event: FormEvent) => {
    event.preventDefault()
    const problem = stageNameProblem(all.leadStages, draft.name)
    if (problem) return setDraft((d) => ({ ...d, error: problem }))
    const stage = actions.addLeadStage({ name: draft.name, color: draft.color })
    toast.show(tr("“{0}” added to the board in every branch.", stage.name ?? ''))
    setDraft({ name: '', color: draft.color })
  }

  const rename = (event: FormEvent, stage: LeadStageDef) => {
    event.preventDefault()
    if (!renaming) return
    const problem = stageNameProblem(all.leadStages, renaming.name, stage.id)
    if (problem) return setRenaming({ ...renaming, error: problem })
    actions.updateLeadStage(stage.id, { name: renaming.name, color: stage.color })
    setRenaming(null)
    toast.show(tr("Stage renamed."))
  }

  if (deleting) return <DeleteStage id={deleting} onDone={() => setDeleting(null)} />

  return (
    <div className="space-y-5">
      <div role="note" className="rounded-control border border-line bg-canvas px-3.5 py-3 text-sm text-ink">
        <p>
          {tr("Shared by {0}. Only the owner can change the stages; administrators move enquiries between them.", branchNames)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {tr("Built-in stages (with a lock) are used by automatic steps such as booking a trial or enrolling, so they can be renamed and moved but not deleted. Demo: this rule is checked in the browser only until the database is connected.")}
        </p>
      </div>

      <ol aria-label={tr("Lead stages")} className="divide-y divide-line rounded-control border border-line">
        {stages.map((s, i) => {
          const name = stageName(all.leadStages, s.id)
          const closed = CLOSED_STAGES.includes(s.id)
          const openIndex = open.findIndex((o) => o.id === s.id)
          const n = count(s.id)
          return (
            <li key={s.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5', closed && 'bg-canvas')} data-stage={s.id}>
              <span className="num w-5 text-right text-sm text-ink-muted">{i + 1}</span>
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', toneDot[s.color])} />
              {renaming?.id === s.id ? (
                <form onSubmit={(e) => rename(e, s)} className="flex min-w-48 flex-1 flex-wrap items-start gap-2">
                  <div className="min-w-40 flex-1">
                    <Input
                      aria-label={tr("New name for {0}", name)}
                      autoFocus
                      value={renaming.name}
                      maxLength={STAGE_NAME_MAX}
                      aria-invalid={renaming.error ? true : undefined}
                      onChange={(e) => setRenaming({ id: s.id, name: e.target.value })}
                      className="h-8"
                    />
                    {renaming.error && <p className="mt-1 text-xs text-danger">{renaming.error}</p>}
                  </div>
                  <Button type="submit" size="sm" variant="primary">
                    {tr("Save")}
                  </Button>
                  <IconButton label={tr("Cancel")} onClick={() => setRenaming(null)}>
                    <X />
                  </IconButton>
                </form>
              ) : (
                <span className="flex min-w-40 flex-1 items-center gap-2">
                  <span className="font-medium text-ink">{name}</span>
                  {isSystemStage(s.id) && (
                    <span title={tr("Built in: used by an automatic step, so it can’t be deleted")} className="inline-flex items-center gap-1 text-xs text-ink-faint">
                      <Lock aria-hidden className="size-3" />
                      <span className="sr-only">{tr("Built in")}</span>
                    </span>
                  )}
                  <span className="num text-xs text-ink-muted">
                    {n} {plural(n, 'enquiry', 'enquiries')}
                  </span>
                </span>
              )}
              <ColorSelect
                label={tr("Colour of {0}", name)}
                value={s.color}
                onChange={(color) => actions.updateLeadStage(s.id, { name, color })}
                className="h-8 w-32 text-sm"
              />
              <span className="flex items-center">
                {renaming?.id !== s.id && (
                  <IconButton label={tr("Rename {0}", name)} onClick={() => setRenaming({ id: s.id, name })}>
                    <Pencil />
                  </IconButton>
                )}
                {!closed && (
                  <>
                    <IconButton label={tr("Move {0} left", name)} onClick={() => actions.moveLeadStage(s.id, -1)} disabled={openIndex <= 0}>
                      <ArrowLeft />
                    </IconButton>
                    <IconButton label={tr("Move {0} right", name)} onClick={() => actions.moveLeadStage(s.id, 1)} disabled={openIndex === open.length - 1}>
                      <ArrowRight />
                    </IconButton>
                  </>
                )}
                {isSystemStage(s.id) ? (
                  <span aria-hidden className="size-9" />
                ) : (
                  <IconButton label={tr("Delete {0}", name)} onClick={() => setDeleting(s.id)} className="hover:bg-danger-soft hover:text-danger">
                    <Trash2 />
                  </IconButton>
                )}
              </span>
              {s.id === 'enrolled' && (
                <p className="basis-full pl-8 text-xs text-ink-muted">{tr("Enrolled and Lost close an enquiry, so they always stay at the end of the board.")}</p>
              )}
            </li>
          )
        })}
      </ol>

      <form onSubmit={add} noValidate className="rounded-control border border-dashed border-line-strong p-3">
        <div className="flex flex-wrap items-start gap-3">
          <Field label={tr("New stage")} error={draft.error} hint={draft.error ? undefined : tr("Added before Enrolled. You can move it afterwards.")} className="min-w-48 flex-1">
            {(p) => (
              <Input
                {...p}
                value={draft.name}
                maxLength={STAGE_NAME_MAX}
                placeholder={tr("e.g. Placement test booked")}
                onChange={(e) => setDraft({ ...draft, name: e.target.value, error: undefined })}
              />
            )}
          </Field>
          <Field label={tr("Colour")} className="w-36">
            {(p) => <ColorSelect {...p} value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />}
          </Field>
          <Button type="submit" variant="primary" className="mt-[1.6rem]">
            <Plus aria-hidden />
            {tr("Add stage")}
          </Button>
        </div>
      </form>
    </div>
  )
}

/** The delete step: shows what's in the stage and where it will go before anything changes. */
function DeleteStage({ id, onDone }: { id: LeadStage; onDone: () => void }) {
  const { owner, actions } = useSchool()
  const toast = useToast()
  const [moveTo, setMoveTo] = useState('')
  const [error, setError] = useState('')
  const all = owner!.data
  const name = stageName(all.leadStages, id)
  const inside = all.leads.filter((l) => l.stage === id)
  const byBranch = all.branches.map((b) => ({ name: b.name, n: inside.filter((l) => l.branchId === b.id).length })).filter((b) => b.n > 0)
  const targets = openStages(all.leadStages).filter((s) => s.id !== id)

  const confirm = () => {
    if (inside.length > 0 && !moveTo) return setError(tr("Choose a stage for these enquiries first."))
    const result = actions.deleteLeadStage(id, moveTo || undefined)
    if (!result.ok) return setError(result.reason)
    toast.show(
      result.moved
        ? tr("“{0}” deleted. Enquiries moved to {1}: {2}.", name, stageName(all.leadStages, moveTo), result.moved)
        : tr("“{0}” deleted.", name),
    )
    onDone()
  }

  return (
    <section aria-labelledby="delete-stage-title" className="space-y-4">
      <h3 id="delete-stage-title" className="text-base font-semibold text-ink">
        {tr("Delete the stage “{0}”?", name)}
      </h3>
      {inside.length === 0 ? (
        <p className="text-sm text-ink">{tr("No enquiries are in this stage in any branch. Deleting it removes the column from every branch’s board.")}</p>
      ) : (
        <>
          <div role="alert" className="flex gap-3 rounded-control border border-warning-mark/40 bg-warning-soft px-3.5 py-3 text-sm text-ink">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium">
                {tr("Enquiries in this stage: {0}", inside.length)}
              </p>
              <p className="mt-0.5">{byBranch.map((b) => `${b.name}: ${b.n}`).join(' · ')}</p>
              <p className="mt-1">{tr("They won’t be deleted. Choose the stage they move to; their details, trials and notes stay as they are.")}</p>
            </div>
          </div>
          <Field label={tr("Move them to")} error={error || undefined}>
            {(p) => (
              <Select
                {...p}
                value={moveTo}
                onChange={(e) => {
                  setMoveTo(e.target.value)
                  setError('')
                }}
              >
                <option value="">{tr("Choose a stage")}</option>
                {targets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {stageName(all.leadStages, s.id)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <p className="text-xs text-ink-muted">{tr("Only open stages are offered: enrolling and marking as lost need their own details, so do those from the board.")}</p>
        </>
      )}
      {inside.length === 0 && error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>{tr("Cancel")}</Button>
        <Button variant="danger" onClick={confirm}>
          {inside.length ? tr("Move {0} and delete", inside.length) : tr("Delete stage")}
        </Button>
      </div>
    </section>
  )
}

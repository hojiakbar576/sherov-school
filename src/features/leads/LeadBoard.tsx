import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { CalendarPlus, Check, ChevronRight, ClipboardCheck, Plus, UserCheck } from 'lucide-react'
import type { Lead, LeadStage } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PhoneLine } from '../../components/ui/CopyButton'
import { leadStageLabel, nextStep, PIPELINE } from '../../lib/admissions'
import { addDays, toISODate } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/cn'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { LostDialog, TrialDialog, TrialResultDialog } from './LeadDialogs'

/** What each column is for, in plain words, and the one button that moves a card on. */
const COLUMN: Record<LeadStage, { hint: string; action?: string; icon?: typeof Check }> = {
  new: { hint: 'Call them back', action: 'Called', icon: Check },
  contacted: { hint: 'Book a trial lesson', action: 'Book trial', icon: CalendarPlus },
  trial_scheduled: { hint: 'After the lesson, record how it went', action: 'Record result', icon: ClipboardCheck },
  trial_done: { hint: 'Put them in a group', action: 'Enroll', icon: UserCheck },
  enrolled: { hint: 'Became students (last 30 days)' },
  lost: { hint: 'Not coming, with the reason' },
}

/** Enrolled cards older than this drop off the board (they're students now). */
const ENROLLED_DAYS = 30

type Dialog = { kind: 'trial' | 'result' | 'lost' | 'enroll'; lead: Lead } | null

/** Oldest waiting first, except trials (soonest first) and enrolled (newest first). */
function sortColumn(stage: LeadStage, items: Lead[]): Lead[] {
  const by = (key: (l: Lead) => string, desc = false) => [...items].sort((a, b) => (desc ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))))
  if (stage === 'trial_scheduled') return by((l) => `${l.trial?.date ?? '9999'}${l.trial?.time ?? ''}`)
  if (stage === 'enrolled' || stage === 'lost') return by((l) => l.updatedAt, true)
  return by((l) => l.updatedAt)
}

/** Whole days between an ISO date-time and now. */
const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)

/** A warning on the card when someone has waited too long. */
function urgency(l: Lead, today: string, now: Date): { text: string; tone: 'danger' | 'info' } | null {
  if (l.stage === 'new') {
    const d = daysSince(l.createdAt, now)
    return d >= 1 ? { text: `Waiting ${d} ${d === 1 ? 'day' : 'days'} for a call`, tone: 'danger' } : null
  }
  if (l.stage === 'contacted') {
    const d = daysSince(l.updatedAt, now)
    return d >= 3 ? { text: `No trial booked for ${d} days`, tone: 'danger' } : null
  }
  if (l.stage === 'trial_scheduled' && l.trial) {
    if (l.trial.date < today) return { text: `Trial was ${formatDate(l.trial.date)}: record the result`, tone: 'danger' }
    if (l.trial.date === today) return { text: `Trial today at ${l.trial.time}`, tone: 'info' }
  }
  if (l.stage === 'trial_done') {
    const d = daysSince(l.updatedAt, now)
    return d >= 3 ? { text: `Trial done ${d} days ago, not enrolled yet`, tone: 'danger' } : null
  }
  return null
}

interface Props {
  leads: Lead[]
  onCreate?: () => void
}

/**
 * Admissions as a board, like LC UP's: one column per step, left to right.
 * Each column says what to do next; each card has one button for that step,
 * and cards can also be dragged to another column. Moves that need details
 * (trial date, trial result, group, reason) open the right form first.
 */
export function LeadBoard({ leads, onCreate }: Props) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const navigate = useNavigate()
  const today = toISODate(now)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<LeadStage | null>(null)
  const [showLost, setShowLost] = useState(false)
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))
  const enrolledSince = addDays(now, -ENROLLED_DAYS).toISOString()

  /** Move a lead to a stage, asking for whatever that step needs. */
  const moveTo = (lead: Lead, stage: LeadStage) => {
    if (lead.stage === stage) return
    if (lead.stage === 'enrolled') {
      toast.show(`${lead.studentName} is already a student. Change things on their student profile.`, 'error')
      return
    }
    switch (stage) {
      case 'new':
      case 'contacted':
        actions.updateLead(lead.id, { stage, lostReason: undefined })
        toast.show(`${lead.studentName}: ${leadStageLabel[stage]}.`)
        return
      case 'trial_scheduled':
        setDialog({ kind: 'trial', lead })
        return
      case 'trial_done':
        if (!lead.trial) {
          toast.show('Book the trial lesson first.', 'error')
          setDialog({ kind: 'trial', lead })
        } else setDialog({ kind: 'result', lead })
        return
      case 'enrolled':
        setDialog({ kind: 'enroll', lead })
        return
      case 'lost':
        setDialog({ kind: 'lost', lead })
    }
  }

  const primary = (lead: Lead) => {
    if (lead.stage === 'new') moveTo(lead, 'contacted')
    else if (lead.stage === 'contacted') moveTo(lead, 'trial_scheduled')
    else if (lead.stage === 'trial_scheduled') setDialog({ kind: 'result', lead })
    else if (lead.stage === 'trial_done') moveTo(lead, 'enrolled')
  }

  const onDrop = (stage: LeadStage) => (e: DragEvent) => {
    e.preventDefault()
    const lead = leads.find((l) => l.id === e.dataTransfer.getData('text/plain'))
    setOver(null)
    setDragging(null)
    if (lead) moveTo(lead, stage)
  }

  const column = (stage: LeadStage, index: number | null) => {
    let items = leads.filter((l) => l.stage === stage)
    if (stage === 'enrolled') items = items.filter((l) => l.updatedAt >= enrolledSince)
    items = sortColumn(stage, items)
    const waiting = items.filter((l) => urgency(l, today, now)?.tone === 'danger').length
    const info = COLUMN[stage]
    const collapsed = stage === 'lost' && !showLost
    return (
      <section
        key={stage}
        aria-label={`${leadStageLabel[stage]}: ${items.length}`}
        onDragOver={(e) => {
          if (!dragging) return
          e.preventDefault()
          setOver(stage)
        }}
        onDragLeave={() => setOver((s) => (s === stage ? null : s))}
        onDrop={onDrop(stage)}
        className={cn(
          'flex shrink-0 snap-start flex-col rounded-panel border transition-colors',
          collapsed ? 'w-40' : 'w-72 xl:w-auto xl:min-w-64 xl:flex-1',
          stage === 'lost' ? 'border-dashed border-line-strong bg-canvas' : 'border-line bg-subtle/60',
          over === stage && 'border-brand bg-brand-soft',
        )}
      >
        <header className="sticky top-0 z-[1] rounded-t-panel border-b border-line bg-inherit px-3 pt-3 pb-2.5">
          <div className="flex items-center gap-2">
            {index !== null && (
              <span aria-hidden className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-2xs font-semibold text-white">
                {index}
              </span>
            )}
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{leadStageLabel[stage]}</h3>
            <span className="num rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink">{items.length}</span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">{info.hint}</p>
          {waiting > 0 && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              {waiting} {waiting === 1 ? 'needs' : 'need'} attention
            </p>
          )}
          {stage === 'new' && onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-control border border-dashed border-line-strong bg-surface py-1.5 text-sm font-medium text-brand hover:border-brand"
            >
              <Plus aria-hidden className="size-4" />
              New enquiry
            </button>
          )}
          {stage === 'lost' && (
            <button type="button" onClick={() => setShowLost((v) => !v)} className="mt-2 text-xs font-medium text-brand hover:underline">
              {showLost ? 'Hide' : 'Show'}
            </button>
          )}
        </header>

        {!collapsed && (
          <ul className="flex-1 space-y-2 p-2">
            {items.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-faint">{dragging ? 'Drop here' : 'Nobody here'}</li>}
            {items.map((l) => {
              const warn = urgency(l, today, now)
              const Action = info.icon
              return (
                <li
                  key={l.id}
                  draggable={l.stage !== 'enrolled'}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', l.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragging(l.id)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  className={cn(
                    'group rounded-control border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
                    warn?.tone === 'danger' ? 'border-danger-mark/50 border-l-4 border-l-danger' : 'border-line',
                    l.stage !== 'enrolled' && 'cursor-grab active:cursor-grabbing',
                    dragging === l.id && 'opacity-40',
                  )}
                >
                  <button type="button" onClick={() => navigate(`/leads/${l.id}`)} className="block w-full px-3 pt-2.5 text-left">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 font-medium text-ink group-hover:text-brand">{l.studentName}</span>
                      <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                    </span>
                    {l.parentName && <span className="block truncate text-xs text-ink-muted">Parent: {l.parentName}</span>}
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <span className="rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-medium text-brand-ink">{l.course}</span>
                      {l.placement?.level && <span className="rounded bg-subtle px-1.5 py-0.5 text-2xs font-medium text-ink">Level {l.placement.level}</span>}
                      {l.source && <span className="rounded bg-subtle px-1.5 py-0.5 text-2xs text-ink-muted">{l.source}</span>}
                    </span>
                  </button>
                  <div className="px-3 pt-1 text-sm text-ink" onClick={(e) => e.stopPropagation()}>
                    <PhoneLine phone={l.phone} />
                  </div>
                  <div className="px-3 pb-2.5 text-xs">
                    {l.stage === 'trial_scheduled' && l.trial && !warn && (
                      <p className="text-ink-muted">
                        Trial {formatDate(l.trial.date)}, {l.trial.time}
                        {l.trial.groupId ? ` · ${groupName.get(l.trial.groupId) ?? ''}` : ''}
                      </p>
                    )}
                    {warn ? (
                      <p className={cn('font-medium', warn.tone === 'danger' ? 'text-danger' : 'text-info')}>{warn.text}</p>
                    ) : (
                      l.stage !== 'trial_scheduled' && <p className="text-ink-muted">{nextStep(l, today)}</p>
                    )}
                  </div>
                  {info.action && Action && (
                    <div className="border-t border-divider px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => primary(l)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium text-brand hover:bg-brand-soft"
                      >
                        <Action aria-hidden className="size-4" />
                        {info.action}
                        <span className="sr-only"> for {l.studentName}</span>
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    )
  }

  return (
    <>
      <p className="mb-2 text-xs text-ink-muted">Tip: drag a card to another column, or use the button on the card. Cards with a red edge are waiting too long.</p>
      <div className="-mx-4 snap-x scroll-px-4 overflow-x-auto px-4 pb-3 lg:mx-0 lg:scroll-px-0 lg:px-0">
        <div className="flex items-start gap-3">
          {PIPELINE.map((stage, i) => column(stage, i + 1))}
          {column('lost', null)}
        </div>
      </div>

      {dialog?.kind === 'trial' && <TrialDialog open lead={dialog.lead} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'result' && <TrialResultDialog open lead={dialog.lead} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'lost' && <LostDialog open lead={dialog.lead} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'enroll' && (
        <StudentFormDialog
          open
          onClose={() => setDialog(null)}
          title={`Enroll ${dialog.lead.studentName}`}
          initial={{
            fullName: dialog.lead.studentName,
            parentName: dialog.lead.parentName,
            parentPhone: dialog.lead.phone,
            groupId: dialog.lead.placement?.recommendedGroupId ?? dialog.lead.trial?.groupId,
          }}
          create={(input) => actions.enrollLead(dialog.lead.id, input)}
          onSaved={(s) => {
            setDialog(null)
            toast.show(`${s.fullName} is now a student.`, 'success')
          }}
        />
      )}
    </>
  )
}

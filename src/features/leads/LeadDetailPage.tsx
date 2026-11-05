import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CalendarPlus, Check, ClipboardCheck, Pencil, RotateCcw, Trash2, UserCheck, UserRoundX, XCircle } from 'lucide-react'
import type { Lead, SystemLeadStage } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/misc'
import { PhoneLine } from '../../components/ui/CopyButton'
import { toISODate } from '../../lib/dates'
import { formatDate, formatRelative } from '../../lib/format'
import { nextStep } from '../../lib/admissions'
import { orderedStages, stageName } from '../../lib/lead-stages'
import { Select } from '../../components/ui/Field'
import { useLeadMove } from './useLeadMove'
import { cn } from '../../lib/cn'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { LeadStageBadge } from './LeadStageBadge'
import { LeadFormDialog, LostDialog, TrialDialog, TrialResultDialog } from './LeadDialogs'
import { ContactLogPanel } from '../contacts/ContactLogPanel'
import { tr } from '../../i18n'

type Open = 'edit' | 'trial' | 'result' | 'lost' | 'enroll' | 'delete' | null

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  )
}
const none = <span className="text-ink-faint">—</span>

/** One enquiry: who they are, where they are in admissions, and the next step. */
export function LeadDetailPage() {
  const { leadId } = useParams()
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState<Open>(null)
  const mover = useLeadMove()
  const lead = data.leads.find((l) => l.id === leadId)

  if (!lead) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={UserRoundX} title={tr("Enquiry not found")} action={<ButtonLink to="/leads">{tr("Back to admissions")}</ButtonLink>}>
          {tr("It may have been deleted, or it belongs to another branch.")}
        </EmptyState>
      </div>
    )
  }

  const today = toISODate(now)
  const group = (id?: string) => data.groups.find((g) => g.id === id)
  const trialGroup = group(lead.trial?.groupId)
  const recommended = group(lead.placement?.recommendedGroupId)
  const student = data.students.find((s) => s.id === lead.studentId)
  const close = () => setOpen(null)

  // Built-in stages have a next step; stages the owner added are moved on with "Move to stage".
  const primary: Record<SystemLeadStage, ReactNode> = {
    new: (
      <Button
        variant="primary"
        onClick={() => {
          actions.updateLead(lead.id, { stage: 'contacted' })
          toast.show(tr("{0} marked as contacted.", lead.studentName))
        }}
      >
        <Check aria-hidden />
        {tr("Mark as contacted")}
      </Button>
    ),
    contacted: (
      <Button variant="primary" onClick={() => setOpen('trial')}>
        <CalendarPlus aria-hidden />
        {tr("Schedule trial lesson")}
      </Button>
    ),
    trial_scheduled: (
      <Button variant="primary" onClick={() => setOpen('result')}>
        <ClipboardCheck aria-hidden />
        {tr("Record trial result")}
      </Button>
    ),
    trial_done: (
      <Button variant="primary" onClick={() => setOpen('enroll')}>
        <UserCheck aria-hidden />
        {tr("Enroll as student")}
      </Button>
    ),
    enrolled: student ? (
      <ButtonLink to={`/students/${student.id}`} variant="primary">
        {tr("Open student profile")}
      </ButtonLink>
    ) : null,
    lost: (
      <Button
        variant="primary"
        onClick={() => {
          actions.updateLead(lead.id, { stage: lead.trial?.attended ? 'trial_done' : 'contacted', lostReason: undefined })
          toast.show(tr("Enquiry reopened."))
        }}
      >
        <RotateCcw aria-hidden />
        {tr("Reopen")}
      </Button>
    ),
  }

  return (
    <>
      <Link to="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {tr("Admissions")}
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{lead.studentName}</h1>
            <LeadStageBadge stage={lead.stage} />
          </div>
          <p className="mt-1 text-ink-muted">
            {lead.course}{' '}{tr("· enquired")}{' '}{formatRelative(lead.createdAt, now).replace(/^(Today|Yesterday|Just now)/, (w) => w.toLowerCase())}
            {lead.source ? tr(" via {0}", lead.source) : ''}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{tr("Next:")}{' '}{nextStep(lead, today)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.stage !== 'enrolled' && lead.stage !== 'lost' && (
            <Button variant="ghost" onClick={() => setOpen('lost')}>
              <XCircle aria-hidden />
              {tr("Mark as lost")}
            </Button>
          )}
          <Button onClick={() => setOpen('edit')}>
            <Pencil aria-hidden />
            {tr("Edit")}
          </Button>
          {primary[lead.stage as SystemLeadStage] ?? null}
        </div>
      </div>

      <PipelineSteps lead={lead} />

      {lead.stage !== 'enrolled' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="move-stage" className="text-ink-muted">
            {tr("Move to stage")}
          </label>
          <Select
            id="move-stage"
            value={lead.stage}
            onChange={(e) => mover.moveTo(lead, e.target.value)}
            className="h-9 w-auto min-w-48"
          >
            {orderedStages(data.leadStages).map((s) => (
              <option key={s.id} value={s.id}>
                {stageName(data.leadStages, s.id)}
              </option>
            ))}
          </Select>
        </div>
      )}
      {mover.dialogs}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel title={tr("Contact and interest")}>
          <dl className="divide-y divide-line text-sm">
            <Row label={tr("Student")}>{lead.studentName}</Row>
            <Row label={tr("Parent")}>{lead.parentName ?? none}</Row>
            <Row label={tr("Phone")}>
              <PhoneLine phone={lead.phone} />
            </Row>
            <Row label={tr("Course")}>{lead.course}</Row>
            <Row label={tr("Source")}>{lead.source ?? none}</Row>
            <Row label={tr("Enquired")}>
              <span className="num">{formatDate(lead.createdAt.slice(0, 10))}</span>
            </Row>
          </dl>
          {lead.notes && <p className="mt-4 rounded-control bg-subtle px-3 py-2 text-sm text-ink">{lead.notes}</p>}
        </Panel>

        <Panel
          title={tr("Trial lesson")}
          actions={
            lead.stage === 'trial_scheduled' || lead.stage === 'contacted' ? (
              <Button size="sm" variant="ghost" onClick={() => setOpen('trial')}>
                {lead.trial && lead.stage === 'trial_scheduled' ? tr("Change") : tr("Book")}
              </Button>
            ) : undefined
          }
        >
          {!lead.trial ? (
            <p className="text-sm text-ink-muted">{tr("No trial lesson booked yet.")}</p>
          ) : (
            <dl className="divide-y divide-line text-sm">
              <Row label={tr("When")}>
                <span className={cn('num', lead.trial.date === today && 'font-medium text-info')}>
                  {lead.trial.date === today ? tr("Today") : formatDate(lead.trial.date)}, {lead.trial.time}
                </span>
              </Row>
              <Row label={tr("Group")}>{trialGroup ? trialGroup.name : tr("Separate meeting")}</Row>
              <Row label={tr("Teacher")}>{data.teachers.find((t) => t.id === lead.trial?.teacherId)?.fullName ?? none}</Row>
              {trialGroup && <Row label={tr("Room")}>{trialGroup.room}</Row>}
              <Row label={tr("Came")}>{lead.trial.attended === null ? <span className="text-ink-faint">{tr("Not yet")}</span> : lead.trial.attended ? tr("Yes") : tr("No")}</Row>
              {lead.trial.outcome && <Row label={tr("How it went")}>{lead.trial.outcome}</Row>}
            </dl>
          )}
        </Panel>

        <Panel
          title={tr("Level placement")}
          actions={
            lead.stage === 'trial_done' ? (
              <Button size="sm" variant="ghost" onClick={() => setOpen('result')}>
                {tr("Change")}
              </Button>
            ) : undefined
          }
        >
          {!lead.placement ? (
            <p className="text-sm text-ink-muted">{tr("Recorded after the trial lesson or a placement test.")}</p>
          ) : (
            <dl className="divide-y divide-line text-sm">
              <Row label={tr("Level")}>{lead.placement.level}</Row>
              <Row label={tr("Score")}>{lead.placement.score ?? none}</Row>
              <Row label={tr("Recommended group")}>{recommended ? recommended.name : none}</Row>
              {lead.placement.notes && <Row label={tr("Notes")}>{lead.placement.notes}</Row>}
              <Row label={tr("Placed on")}>
                <span className="num">{formatDate(lead.placement.on)}</span>
              </Row>
            </dl>
          )}
        </Panel>
      </div>

      {lead.stage === 'lost' && <p className="mt-4 text-sm text-ink-muted">{tr("Lost:")}{' '}{lead.lostReason ?? tr("no reason given")}.</p>}

      <ContactLogPanel subject={{ type: 'lead', id: lead.id }} contacts={[lead.parentName, lead.studentName].filter((x): x is string => Boolean(x))} className="mt-6" />

      <div className="mt-8 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={() => setOpen('delete')} className="text-ink-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 aria-hidden />
          {tr("Delete enquiry")}
        </Button>
      </div>

      <LeadFormDialog open={open === 'edit'} lead={lead} onClose={close} />
      <TrialDialog open={open === 'trial'} lead={lead} onClose={close} />
      <TrialResultDialog open={open === 'result'} lead={lead} onClose={close} />
      <LostDialog open={open === 'lost'} lead={lead} onClose={close} />
      <StudentFormDialog
        open={open === 'enroll'}
        onClose={close}
        title={tr("Enroll {0}", lead.studentName)}
        initial={{ fullName: lead.studentName, parentName: lead.parentName, parentPhone: lead.phone, groupId: lead.placement?.recommendedGroupId ?? lead.trial?.groupId }}
        create={(input) => actions.enrollLead(lead.id, input)}
        onSaved={(s) => navigate(`/students/${s.id}`)}
      />
      <ConfirmDialog
        open={open === 'delete'}
        title={tr("Delete this enquiry?")}
        confirmLabel={tr("Delete enquiry")}
        onClose={close}
        onConfirm={() => {
          actions.deleteLead(lead.id)
          toast.show(tr("Enquiry deleted."))
          navigate('/leads', { replace: true })
        }}
      >
        <p>
          {lead.studentName}{tr("’s enquiry, trial and placement will be removed. To keep it on record but out of the way, mark it as lost instead.")}
          {student ? tr(" The student record is not affected.") : ''}
        </p>
      </ConfirmDialog>
    </>
  )
}

/** Where this enquiry is in the pipeline. */
function PipelineSteps({ lead }: { lead: Lead }) {
  const { data } = useSchool()
  // The owner's stages in board order, ending at Enrolled; Lost is shown separately.
  const pipeline = orderedStages(data.leadStages)
    .map((s) => s.id)
    .filter((id) => id !== 'lost')
  const reached = pipeline.indexOf(lead.stage)
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label={tr("Admissions progress")}>
      {pipeline.map((stage, i) => {
        const done = lead.stage !== 'lost' && i < reached
        const current = stage === lead.stage
        return (
          <li key={stage} className="flex items-center gap-1">
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                current ? 'bg-brand text-white' : done ? 'bg-brand-soft text-brand-ink' : 'bg-subtle text-ink-muted',
              )}
            >
              {done && <span className="sr-only">{tr("Done:")}{' '}</span>}
              {stageName(data.leadStages, stage)}
            </span>
            {i < pipeline.length - 1 && <span aria-hidden className="h-px w-3 bg-line-strong" />}
          </li>
        )
      })}
      {lead.stage === 'lost' && (
        <li>
          <span aria-current="step" className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">
            {stageName(data.leadStages, 'lost')}
          </span>
        </li>
      )}
    </ol>
  )
}

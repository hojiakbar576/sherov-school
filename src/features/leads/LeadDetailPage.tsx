import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CalendarPlus, Check, ClipboardCheck, Pencil, RotateCcw, Trash2, UserCheck, UserRoundX, XCircle } from 'lucide-react'
import type { Lead, LeadStage } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/misc'
import { PhoneLine } from '../../components/ui/CopyButton'
import { toISODate } from '../../lib/dates'
import { formatDate, formatRelative } from '../../lib/format'
import { leadStageLabel, nextStep, PIPELINE } from '../../lib/admissions'
import { cn } from '../../lib/cn'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { LeadStageBadge } from './LeadStageBadge'
import { LeadFormDialog, LostDialog, TrialDialog, TrialResultDialog } from './LeadDialogs'
import { ContactLogPanel } from '../contacts/ContactLogPanel'

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
  const lead = data.leads.find((l) => l.id === leadId)

  if (!lead) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={UserRoundX} title="Enquiry not found" action={<ButtonLink to="/leads">Back to admissions</ButtonLink>}>
          It may have been deleted, or it belongs to another branch.
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

  const primary: Record<LeadStage, ReactNode> = {
    new: (
      <Button
        variant="primary"
        onClick={() => {
          actions.updateLead(lead.id, { stage: 'contacted' })
          toast.show(`${lead.studentName} marked as contacted.`)
        }}
      >
        <Check aria-hidden />
        Mark as contacted
      </Button>
    ),
    contacted: (
      <Button variant="primary" onClick={() => setOpen('trial')}>
        <CalendarPlus aria-hidden />
        Schedule trial lesson
      </Button>
    ),
    trial_scheduled: (
      <Button variant="primary" onClick={() => setOpen('result')}>
        <ClipboardCheck aria-hidden />
        Record trial result
      </Button>
    ),
    trial_done: (
      <Button variant="primary" onClick={() => setOpen('enroll')}>
        <UserCheck aria-hidden />
        Enroll as student
      </Button>
    ),
    enrolled: student ? (
      <ButtonLink to={`/students/${student.id}`} variant="primary">
        Open student profile
      </ButtonLink>
    ) : null,
    lost: (
      <Button
        variant="primary"
        onClick={() => {
          actions.updateLead(lead.id, { stage: lead.trial?.attended ? 'trial_done' : 'contacted', lostReason: undefined })
          toast.show('Enquiry reopened.')
        }}
      >
        <RotateCcw aria-hidden />
        Reopen
      </Button>
    ),
  }

  return (
    <>
      <Link to="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Admissions
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{lead.studentName}</h1>
            <LeadStageBadge stage={lead.stage} />
          </div>
          <p className="mt-1 text-ink-muted">
            {lead.course} · enquired {formatRelative(lead.createdAt, now).replace(/^(Today|Yesterday|Just now)/, (w) => w.toLowerCase())}
            {lead.source ? ` via ${lead.source}` : ''}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">Next: {nextStep(lead, today)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.stage !== 'enrolled' && lead.stage !== 'lost' && (
            <Button variant="ghost" onClick={() => setOpen('lost')}>
              <XCircle aria-hidden />
              Mark as lost
            </Button>
          )}
          <Button onClick={() => setOpen('edit')}>
            <Pencil aria-hidden />
            Edit
          </Button>
          {primary[lead.stage]}
        </div>
      </div>

      <PipelineSteps lead={lead} />

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel title="Contact and interest">
          <dl className="divide-y divide-line text-sm">
            <Row label="Student">{lead.studentName}</Row>
            <Row label="Parent">{lead.parentName ?? none}</Row>
            <Row label="Phone">
              <PhoneLine phone={lead.phone} />
            </Row>
            <Row label="Course">{lead.course}</Row>
            <Row label="Source">{lead.source ?? none}</Row>
            <Row label="Enquired">
              <span className="num">{formatDate(lead.createdAt.slice(0, 10))}</span>
            </Row>
          </dl>
          {lead.notes && <p className="mt-4 rounded-control bg-subtle px-3 py-2 text-sm text-ink">{lead.notes}</p>}
        </Panel>

        <Panel
          title="Trial lesson"
          actions={
            lead.stage === 'trial_scheduled' || lead.stage === 'contacted' ? (
              <Button size="sm" variant="ghost" onClick={() => setOpen('trial')}>
                {lead.trial && lead.stage === 'trial_scheduled' ? 'Change' : 'Book'}
              </Button>
            ) : undefined
          }
        >
          {!lead.trial ? (
            <p className="text-sm text-ink-muted">No trial lesson booked yet.</p>
          ) : (
            <dl className="divide-y divide-line text-sm">
              <Row label="When">
                <span className={cn('num', lead.trial.date === today && 'font-medium text-info')}>
                  {lead.trial.date === today ? 'Today' : formatDate(lead.trial.date)}, {lead.trial.time}
                </span>
              </Row>
              <Row label="Group">{trialGroup ? trialGroup.name : 'Separate meeting'}</Row>
              <Row label="Teacher">{data.teachers.find((t) => t.id === lead.trial?.teacherId)?.fullName ?? none}</Row>
              {trialGroup && <Row label="Room">{trialGroup.room}</Row>}
              <Row label="Came">{lead.trial.attended === null ? <span className="text-ink-faint">Not yet</span> : lead.trial.attended ? 'Yes' : 'No'}</Row>
              {lead.trial.outcome && <Row label="How it went">{lead.trial.outcome}</Row>}
            </dl>
          )}
        </Panel>

        <Panel
          title="Level placement"
          actions={
            lead.stage === 'trial_done' ? (
              <Button size="sm" variant="ghost" onClick={() => setOpen('result')}>
                Change
              </Button>
            ) : undefined
          }
        >
          {!lead.placement ? (
            <p className="text-sm text-ink-muted">Recorded after the trial lesson or a placement test.</p>
          ) : (
            <dl className="divide-y divide-line text-sm">
              <Row label="Level">{lead.placement.level}</Row>
              <Row label="Score">{lead.placement.score ?? none}</Row>
              <Row label="Recommended group">{recommended ? recommended.name : none}</Row>
              {lead.placement.notes && <Row label="Notes">{lead.placement.notes}</Row>}
              <Row label="Placed on">
                <span className="num">{formatDate(lead.placement.on)}</span>
              </Row>
            </dl>
          )}
        </Panel>
      </div>

      {lead.stage === 'lost' && <p className="mt-4 text-sm text-ink-muted">Lost: {lead.lostReason ?? 'no reason given'}.</p>}

      <ContactLogPanel subject={{ type: 'lead', id: lead.id }} contacts={[lead.parentName, lead.studentName].filter((x): x is string => Boolean(x))} className="mt-6" />

      <div className="mt-8 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={() => setOpen('delete')} className="text-ink-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 aria-hidden />
          Delete enquiry
        </Button>
      </div>

      <LeadFormDialog open={open === 'edit'} lead={lead} onClose={close} />
      <TrialDialog open={open === 'trial'} lead={lead} onClose={close} />
      <TrialResultDialog open={open === 'result'} lead={lead} onClose={close} />
      <LostDialog open={open === 'lost'} lead={lead} onClose={close} />
      <StudentFormDialog
        open={open === 'enroll'}
        onClose={close}
        title={`Enroll ${lead.studentName}`}
        initial={{ fullName: lead.studentName, parentName: lead.parentName, parentPhone: lead.phone, groupId: lead.placement?.recommendedGroupId ?? lead.trial?.groupId }}
        create={(input) => actions.enrollLead(lead.id, input)}
        onSaved={(s) => navigate(`/students/${s.id}`)}
      />
      <ConfirmDialog
        open={open === 'delete'}
        title="Delete this enquiry?"
        confirmLabel="Delete enquiry"
        onClose={close}
        onConfirm={() => {
          actions.deleteLead(lead.id)
          toast.show('Enquiry deleted.')
          navigate('/leads', { replace: true })
        }}
      >
        <p>
          {lead.studentName}’s enquiry, trial and placement will be removed. To keep it on record but out of the way, mark it as lost instead.
          {student ? ' The student record is not affected.' : ''}
        </p>
      </ConfirmDialog>
    </>
  )
}

/** Where this enquiry is in the pipeline. */
function PipelineSteps({ lead }: { lead: Lead }) {
  const reached = PIPELINE.indexOf(lead.stage)
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label="Admissions progress">
      {PIPELINE.map((stage, i) => {
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
              {done && <span className="sr-only">Done: </span>}
              {leadStageLabel[stage]}
            </span>
            {i < PIPELINE.length - 1 && <span aria-hidden className="h-px w-3 bg-line-strong" />}
          </li>
        )
      })}
      {lead.stage === 'lost' && (
        <li>
          <span aria-current="step" className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">
            Lost
          </span>
        </li>
      )}
    </ol>
  )
}

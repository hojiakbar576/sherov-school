import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Download, Plus, UserRoundPlus } from 'lucide-react'
import type { Lead, LeadStage } from '../../types'
import { useSchool } from '../../data/school-context'
import { useBranchChoice } from '../../hooks/useBranchChoice'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { PhoneLine } from '../../components/ui/CopyButton'
import { toISODate } from '../../lib/dates'
import { formatDate, formatRelative } from '../../lib/format'
import { isOpenLead, leadStageLabel, nextStep, PIPELINE, trialsOn } from '../../lib/admissions'
import { downloadCSV } from '../../lib/csv'
import { cn } from '../../lib/cn'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { LeadStageBadge } from './LeadStageBadge'
import { LeadFormDialog } from './LeadDialogs'
import { LeadBoard } from './LeadBoard'
import { Select } from '../../components/ui/Field'

const FILTERS = ['q', 'stage', 'view', 'course'] as const
type View = LeadStage | 'open' | 'all'

/**
 * Admissions: everyone interested in studying who isn't a student yet. The
 * steps across the top are the pipeline; each is also a filter.
 */
export function LeadsPage() {
  const { data, now } = useSchool()
  const needsBranch = useBranchChoice()
  const navigate = useNavigate()
  const { values, set } = useListParams(FILTERS)
  const [creating, setCreating] = useState(false)
  const today = toISODate(now)
  const view: View = (values.stage as View) || 'open'

  const counts = useMemo(() => {
    const c = Object.fromEntries([...PIPELINE, 'lost'].map((s) => [s, 0])) as Record<LeadStage, number>
    for (const l of data.leads) c[l.stage] += 1
    return c
  }, [data.leads])
  const open = data.leads.filter(isOpenLead).length
  const trialsToday = trialsOn(data.leads, today)
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))

  const board = values.view !== 'list'
  // Search and course apply to both views; the stage filter only to the list
  // (on the board every stage is its own column).
  const matching = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return data.leads
      .filter((l) => !values.course || l.course === values.course)
      .filter(
        (l) =>
          !q ||
          l.studentName.toLowerCase().includes(q) ||
          (l.parentName ?? '').toLowerCase().includes(q) ||
          (digits.length >= 3 && l.phone.replace(/\D/g, '').includes(digits)),
      )
  }, [data.leads, values.q, values.course])
  const courses = useMemo(() => [...new Set(data.leads.map((l) => l.course))].sort(), [data.leads])

  const rows = useMemo(() => {
    return matching
      .filter((l) => (view === 'all' ? true : view === 'open' ? isOpenLead(l) : l.stage === view))
      .sort((a, b) => {
        // Trials soonest first; otherwise newest enquiry first.
        const ta = a.stage === 'trial_scheduled' ? `${a.trial?.date}${a.trial?.time}` : ''
        const tb = b.stage === 'trial_scheduled' ? `${b.trial?.date}${b.trial?.time}` : ''
        if (ta && tb) return ta.localeCompare(tb)
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [matching, view])

  const exportCSV = () =>
    downloadCSV(`sherov-school-leads-${today}.csv`, [
      ['Student', 'Parent', 'Phone', 'Course', 'Stage', 'Next step', 'Trial date', 'Placement level', 'Source', 'Enquiry date', 'Notes'],
      ...rows.map((l) => [l.studentName, l.parentName, l.phone, l.course, leadStageLabel[l.stage], nextStep(l, today), l.trial?.date, l.placement?.level, l.source, l.createdAt.slice(0, 10), l.notes]),
    ])

  const step = (stage: View, label: string, n: number) => (
    <button
      type="button"
      onClick={() => set('stage', stage === 'open' ? '' : stage)}
      aria-pressed={view === stage}
      className={cn(
        'flex min-w-0 flex-col items-start rounded-control border px-3 py-2 text-left',
        view === stage ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink hover:border-line-strong',
      )}
    >
      <span className="num text-lg leading-tight font-semibold">{n}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </button>
  )

  return (
    <>
      <PageHeader
        title="Admissions"
        description="Enquiries from people who want to study: call them, book a trial lesson, place them at the right level, then enroll."
        actions={
          <>
            <Button onClick={exportCSV} disabled={rows.length === 0}>
              <Download aria-hidden />
              Export CSV
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)} disabled={Boolean(needsBranch)} title={needsBranch ?? undefined}>
              <Plus aria-hidden />
              New enquiry
            </Button>
          </>
        }
      />

      {trialsToday.length > 0 && (
        <div className="mb-4 rounded-panel border border-info/30 bg-info-soft px-4 py-3 text-sm text-ink">
          <p className="font-medium">
            {trialsToday.length} trial {trialsToday.length === 1 ? 'lesson' : 'lessons'} today
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {trialsToday.map((l) => (
              <li key={l.id}>
                <Link to={`/leads/${l.id}`} className="hover:underline">
                  <span className="num font-medium">{l.trial?.time}</span> {l.studentName}
                  {l.trial?.groupId ? `, ${groupName.get(l.trial.groupId)}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!board && (
      <nav aria-label="Pipeline" className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {step('open', 'All open', open)}
        {PIPELINE.map((s) => (
          <span key={s} className="contents">
            {step(s, leadStageLabel[s], counts[s])}
          </span>
        ))}
        {step('lost', 'Lost', counts.lost)}
        {step('all', 'Everyone', data.leads.length)}
      </nav>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <RangeToggle
          label="Show as"
          value={board ? 'board' : 'list'}
          onChange={(v) => set('view', v === 'list' ? 'list' : '')}
          options={[
            { value: 'board', label: 'Board' },
            { value: 'list', label: 'List' },
          ]}
        />
        {board && (
          <>
            <SearchInput label="Search enquiries" value={values.q} onChange={(v) => set('q', v)} placeholder="Name or phone" />
            <Select aria-label="Course" value={values.course} onChange={(e) => set('course', e.target.value)} className="sm:w-48">
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <p className="num text-sm text-ink-muted sm:ml-auto">
              {matching.filter(isOpenLead).length} open {matching.filter(isOpenLead).length === 1 ? 'enquiry' : 'enquiries'}
            </p>
          </>
        )}
      </div>

      {board ? (
        <LeadBoard leads={matching} onCreate={needsBranch ? undefined : () => setCreating(true)} />
      ) : (
      <section aria-label="Enquiries" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchInput label="Search enquiries" value={values.q} onChange={(v) => set('q', v)} placeholder="Name or phone" />
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'enquiry' : 'enquiries'}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={UserRoundPlus}
            title={data.leads.length ? 'Nothing here' : 'No enquiries yet'}
            action={needsBranch ? undefined : <Button onClick={() => setCreating(true)}>New enquiry</Button>}
          >
            {data.leads.length ? 'No enquiries at this stage. Try another step above.' : 'When someone calls or walks in asking about classes, add them here.'}
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">Enquiries. Click a row to open it.</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>Name</th>
                    <th scope="col" className={th}>Phone</th>
                    <th scope="col" className={th}>Course</th>
                    <th scope="col" className={th}>Stage</th>
                    <th scope="col" className={th}>Next step</th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>Enquired</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((l) => (
                    <LeadRow key={l.id} lead={l} today={today} now={now} onOpen={() => navigate(`/leads/${l.id}`)} />
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/leads/${l.id}`} className="font-medium text-ink hover:underline">
                      {l.studentName}
                    </Link>
                    <LeadStageBadge stage={l.stage} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {l.course}
                    {l.parentName ? ` · Parent: ${l.parentName}` : ''}
                  </p>
                  <PhoneLine phone={l.phone} className="text-sm text-ink" />
                  <p className={cn('text-xs', nextStepTone(l, today))}>{nextStep(l, today)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      )}

      <LeadFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/leads/${id}`)} />
    </>
  )
}

function nextStepTone(l: Lead, today: string): string {
  if (l.stage === 'trial_scheduled' && l.trial && l.trial.date < today) return 'font-medium text-warning'
  if (l.stage === 'trial_scheduled' && l.trial?.date === today) return 'font-medium text-info'
  if (l.stage === 'new') return 'font-medium text-ink'
  return 'text-ink-muted'
}

function LeadRow({ lead: l, today, now, onOpen }: { lead: Lead; today: string; now: Date; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-canvas/70">
      <td className={td}>
        <Link to={`/leads/${l.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-brand hover:underline">
          {l.studentName}
        </Link>
        {l.parentName && <p className="text-xs text-ink-muted">Parent: {l.parentName}</p>}
      </td>
      <td className={cn(td, 'py-2')} onClick={(e) => e.stopPropagation()}>
        <PhoneLine phone={l.phone} />
      </td>
      <td className={td}>{l.course}</td>
      <td className={td}>
        <LeadStageBadge stage={l.stage} />
      </td>
      <td className={cn(td, nextStepTone(l, today))}>{nextStep(l, today)}</td>
      <td className={cn(td, 'hidden whitespace-nowrap text-ink-muted xl:table-cell')} title={formatDate(l.createdAt.slice(0, 10))}>
        {formatRelative(l.createdAt, now)}
        {l.source && <p className="text-xs">{l.source}</p>}
      </td>
    </tr>
  )
}

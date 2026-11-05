import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Download, Plus, Settings2, UserRoundPlus } from 'lucide-react'
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
import { isOpenLead, nextStep, trialsOn } from '../../lib/admissions'
import { orderedStages, stageCounts, stageName } from '../../lib/lead-stages'
import { downloadCSV } from '../../lib/csv'
import { cn } from '../../lib/cn'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { LeadStageBadge } from './LeadStageBadge'
import { LeadFormDialog } from './LeadDialogs'
import { LeadBoard } from './LeadBoard'
import { LeadStagesDialog } from './LeadStagesManager'
import { Select } from '../../components/ui/Field'
import { plural, tr } from '../../i18n'

const FILTERS = ['q', 'stage', 'view', 'course'] as const
type View = LeadStage | 'open' | 'all'

/**
 * Admissions: everyone interested in studying who isn't a student yet. The
 * steps across the top are the pipeline; each is also a filter.
 */
export function LeadsPage() {
  const { data, now, user } = useSchool()
  // Only the owner manages the stages (shared by every branch). This is a
  // browser-side check for the demo; the database must enforce it too.
  const isOwner = user?.role === 'owner'
  const [managing, setManaging] = useState(false)
  const needsBranch = useBranchChoice()
  const navigate = useNavigate()
  const { values, set } = useListParams(FILTERS)
  const [creating, setCreating] = useState(false)
  const today = toISODate(now)
  const view: View = (values.stage as View) || 'open'

  const counts = useMemo(() => stageCounts(data.leads), [data.leads])
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
      [tr("Student"), tr("Parent"), tr("Phone"), tr("Course"), tr("Stage"), tr("Next step"), tr("Trial date"), tr("Placement level"), tr("Source"), tr("Enquiry date"), tr("Notes")],
      ...rows.map((l) => [l.studentName, l.parentName, l.phone, l.course, stageName(data.leadStages, l.stage), nextStep(l, today), l.trial?.date, l.placement?.level, l.source, l.createdAt.slice(0, 10), l.notes]),
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
        title={tr("Admissions")}
        actions={
          <>
            {isOwner && (
              <Button variant="ghost" onClick={() => setManaging(true)}>
                <Settings2 aria-hidden />
                {tr("Manage lead stages")}
              </Button>
            )}
            <Button onClick={exportCSV} disabled={rows.length === 0}>
              <Download aria-hidden />
              {tr("Export CSV")}
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)} disabled={Boolean(needsBranch)} title={needsBranch ?? undefined}>
              <Plus aria-hidden />
              {tr("New enquiry")}
            </Button>
          </>
        }
      />

      {trialsToday.length > 0 && (
        <div className="mb-4 rounded-panel border border-info/30 bg-info-soft px-4 py-3 text-sm text-ink">
          <p className="font-medium">
            {tr("{0} trial {1} today", trialsToday.length, plural(trialsToday.length, 'lesson', 'lessons'))}
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
      <nav aria-label={tr("Pipeline")} className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {step('open', tr('All open'), open)}
        {orderedStages(data.leadStages).map((s) => (
          <span key={s.id} className="contents">
            {step(s.id, stageName(data.leadStages, s.id), counts.get(s.id) ?? 0)}
          </span>
        ))}
        {step('all', tr('Everyone'), data.leads.length)}
      </nav>
      )}

      {isOwner && <LeadStagesDialog open={managing} onClose={() => setManaging(false)} />}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <RangeToggle
          label={tr("Show as")}
          value={board ? 'board' : 'list'}
          onChange={(v) => set('view', v === 'list' ? 'list' : '')}
          options={[
            { value: 'board', label: tr("Board") },
            { value: 'list', label: tr("List") },
          ]}
        />
        {board && (
          <>
            <SearchInput label={tr("Search enquiries")} value={values.q} onChange={(v) => set('q', v)} placeholder={tr("Name or phone")} />
            <Select aria-label={tr("Course")} value={values.course} onChange={(e) => set('course', e.target.value)} className="sm:w-48">
              <option value="">{tr("All courses")}</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <p className="num text-sm text-ink-muted sm:ml-auto">
              {matching.filter(isOpenLead).length}{' '}{tr("open")}{' '}{matching.filter(isOpenLead).length === 1 ? tr("enquiry") : tr("enquiries")}
            </p>
          </>
        )}
      </div>

      {board ? (
        <LeadBoard leads={matching} onCreate={needsBranch ? undefined : () => setCreating(true)} />
      ) : (
      <section aria-label={tr("Enquiries")} className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchInput label={tr("Search enquiries")} value={values.q} onChange={(v) => set('q', v)} placeholder={tr("Name or phone")} />
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {rows.length} {rows.length === 1 ? tr("enquiry") : tr("enquiries")}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={UserRoundPlus}
            title={data.leads.length ? tr("Nothing here") : tr("No enquiries yet")}
            action={needsBranch ? undefined : <Button onClick={() => setCreating(true)}>{tr("New enquiry")}</Button>}
          >
            {data.leads.length ? tr("No enquiries at this stage. Try another step above.") : tr("When someone calls or walks in asking about classes, add them here.")}
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">{tr("Enquiries. Click a row to open it.")}</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>{tr("Name")}</th>
                    <th scope="col" className={th}>{tr("Phone")}</th>
                    <th scope="col" className={th}>{tr("Course")}</th>
                    <th scope="col" className={th}>{tr("Stage")}</th>
                    <th scope="col" className={th}>{tr("Next step")}</th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>{tr("Enquired")}</th>
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
                    {l.parentName ? tr(" · Parent: {0}", l.parentName) : ''}
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
        {l.parentName && <p className="text-xs text-ink-muted">{tr("Parent:")}{' '}{l.parentName}</p>}
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

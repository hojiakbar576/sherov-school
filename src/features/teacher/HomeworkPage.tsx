import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, NotebookPen, Plus } from 'lucide-react'
import type { Homework } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { EmptyState } from '../../components/ui/misc'
import { Badge } from '../../components/ui/Badge'
import { addDays, toISODate } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { homeworkProgress, type HomeworkProgress } from '../../lib/performance'
import { splitHomework } from './teacher-metrics'
import { HomeworkFormDialog } from './HomeworkFormDialog'
import { tr } from '../../i18n'

const FILTERS = ['group', 'show'] as const

/** Every assignment with how far evaluation has got. Each opens its evaluation table. */
export function HomeworkPage() {
  const { data, now } = useSchool()
  const navigate = useNavigate()
  const { values, set } = useListParams(FILTERS)
  // ?new=1 (from a group page) opens the form straight away.
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get('new') === '1')
  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])
  const progress = useMemo(() => new Map(data.homework.map((h) => [h.id, homeworkProgress(data, h)])), [data])
  const toEvaluateOnly = values.show === 'to-evaluate'
  const { current, past } = splitHomework(
    data.homework.filter((h) => (!values.group || h.groupId === values.group) && (!toEvaluateOnly || (progress.get(h.id)?.toEvaluate ?? 0) > 0)),
    now,
  )
  const today = toISODate(now)
  const tomorrow = toISODate(addDays(now, 1))
  const waiting = [...progress.values()].reduce((sum, p) => sum + p.toEvaluate, 0)

  const row = (h: Homework) => {
    const p = progress.get(h.id) as HomeworkProgress
    return (
      <li key={h.id}>
        <Link to={`/teacher/homework/${h.id}`} className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-canvas">
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-ink group-hover:text-brand-ink">{h.title}</h3>
              {h.dueDate === today && <Badge tone="warning">{tr("Due today")}</Badge>}
              {h.dueDate === tomorrow && <Badge tone="info">{tr("Due tomorrow")}</Badge>}
            </div>
            <p className="num mt-0.5 text-sm text-ink-muted">
              {groupName.get(h.groupId) ?? tr("Group")}{' '}{tr("· set")}{' '}{formatDate(h.assignedOn)} · {h.dueDate < today ? tr("was due") : tr("due")} {formatDate(h.dueDate)}
            </p>
          </div>
          <dl className="num flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">{tr("Handed in")}</dt>
              <dd className="font-medium text-ink">
                {p.handedIn}/{p.assigned}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{tr("Evaluated")}</dt>
              <dd className="font-medium text-ink">{p.evaluated}</dd>
            </div>
            <div className="w-24">
              <dt className="text-xs text-ink-muted">{tr("To evaluate")}</dt>
              <dd>{p.toEvaluate > 0 ? <Badge tone="accent">{p.toEvaluate}{' '}{tr("waiting")}</Badge> : <span className="text-ink-faint">{tr("None")}</span>}</dd>
            </div>
          </dl>
          <ChevronRight aria-hidden className="hidden size-4 text-ink-faint sm:block" />
        </Link>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        title={tr("Homework")}
        description={tr("Set homework for your groups, then open an assignment to record who handed it in and evaluate each student.")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)} disabled={data.groups.length === 0}>
            <Plus aria-hidden />
            {tr("New homework")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select aria-label={tr("Filter by group")} value={values.group} onChange={(e) => set('group', e.target.value)} className="sm:w-64">
          <option value="">{tr("All my groups")}</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <RangeToggle
          label={tr("Show")}
          value={toEvaluateOnly ? 'to-evaluate' : 'all'}
          onChange={(v) => set('show', v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: tr("All") },
            { value: 'to-evaluate', label: tr("To evaluate ({0})", waiting) },
          ]}
        />
      </div>

      <div className="space-y-6">
        <Panel title={tr("Current")} description={tr("{0} not yet past the deadline", current.length)} flush>
          {current.length === 0 ? (
            <EmptyState icon={NotebookPen} title={toEvaluateOnly ? tr("Nothing waiting here") : tr("No homework due")} action={toEvaluateOnly ? undefined : <Button onClick={() => setCreating(true)}>{tr("Set homework")}</Button>}>
              {toEvaluateOnly ? tr("Everything handed in for current homework is evaluated.") : tr("Nothing is due{0} from today on.", values.group ? tr(" for this group") : '')}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">{current.map(row)}</ul>
          )}
        </Panel>
        <Panel title={tr("Previous")} description={past.length ? tr("{0} past the deadline", past.length) : undefined} flush>
          {past.length === 0 ? (
            <EmptyState icon={NotebookPen} title={toEvaluateOnly ? tr("All evaluated") : tr("No previous homework")} />
          ) : (
            <ul className="divide-y divide-line border-t border-line">{past.map(row)}</ul>
          )}
        </Panel>
      </div>

      <HomeworkFormDialog open={creating} onClose={() => setCreating(false)} defaultGroup={values.group} onSaved={(id) => navigate(`/teacher/homework/${id}`)} />
    </>
  )
}

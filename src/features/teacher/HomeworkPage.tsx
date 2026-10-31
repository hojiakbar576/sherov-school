import { useMemo, useState, type FormEvent } from 'react'
import { NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Homework } from '../../types'
import { useSchool, type HomeworkInput } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/misc'
import { Badge } from '../../components/ui/Badge'
import { addDays, isValidISODate, toISODate } from '../../lib/dates'
import { formatDate, formatRelative } from '../../lib/format'
import { splitHomework } from './teacher-metrics'

const FILTERS = ['group'] as const

export function HomeworkPage() {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const { values, set } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Homework | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Homework | null>(null)
  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])
  const { current, past } = splitHomework(
    data.homework.filter((h) => !values.group || h.groupId === values.group),
    now,
  )
  const today = toISODate(now)
  const tomorrow = toISODate(addDays(now, 1))

  const item = (h: Homework, isPast: boolean) => (
    <li key={h.id} className="flex gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-ink">{h.title}</h3>
          {h.dueDate === today && <Badge tone="warning">Due today</Badge>}
          {h.dueDate === tomorrow && <Badge tone="accent">Due tomorrow</Badge>}
        </div>
        <p className="num mt-0.5 text-sm text-ink-muted">
          {groupName.get(h.groupId) ?? 'Group'} · {isPast ? 'was due' : 'due'} {formatDate(h.dueDate)}
        </p>
        <p className="mt-2 max-w-[70ch] text-sm whitespace-pre-line text-ink">{h.description}</p>
        <p className="mt-2 text-xs text-ink-faint">
          Set {formatRelative(h.createdAt, now).replace(/^(Today|Yesterday|Just now)/, (w) => w.toLowerCase())}
          {h.updatedAt && `, edited ${formatRelative(h.updatedAt, now).replace(/^(Today|Yesterday|Just now)/, (w) => w.toLowerCase())}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <IconButton label={`Edit ${h.title}`} onClick={() => setEditing(h)}>
          <Pencil />
        </IconButton>
        <IconButton label={`Delete ${h.title}`} onClick={() => setDeleting(h)} className="hover:bg-danger-soft hover:text-danger">
          <Trash2 />
        </IconButton>
      </div>
    </li>
  )

  return (
    <>
      <PageHeader
        title="Homework"
        description="Set homework for your groups. Students don’t submit work here yet; this is a record of what was set."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')} disabled={data.groups.length === 0}>
            <Plus aria-hidden />
            New homework
          </Button>
        }
      />

      <div className="mb-4">
        <Select aria-label="Filter by group" value={values.group} onChange={(e) => set('group', e.target.value)} className="sm:w-64">
          <option value="">All my groups</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-6">
        <Panel title="Current" description={`${current.length} still due`} flush>
          {current.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No homework due" action={<Button onClick={() => setEditing('new')}>Set homework</Button>}>
              Nothing is due{values.group ? ' for this group' : ''} from today on.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">{current.map((h) => item(h, false))}</ul>
          )}
        </Panel>
        <Panel title="Previous" description={past.length ? `${past.length} past deadlines` : undefined} flush>
          {past.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No previous homework" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">{past.map((h) => item(h, true))}</ul>
          )}
        </Panel>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New homework' : 'Edit homework'}>
        {editing !== null && (
          <HomeworkForm
            homework={editing === 'new' ? undefined : editing}
            defaultGroup={values.group}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this homework?"
        confirmLabel="Delete homework"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting && actions.deleteHomework(deleting.id)) toast.show(`Deleted “${deleting.title}”.`)
        }}
      >
        <p>“{deleting?.title}” will be removed from {groupName.get(deleting?.groupId ?? '') ?? 'the group'}. This can’t be undone.</p>
      </ConfirmDialog>
    </>
  )
}

type Errors = Partial<Record<keyof HomeworkInput, string>>

function HomeworkForm({ homework, defaultGroup, onClose }: { homework?: Homework; defaultGroup: string; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const running = data.groups.filter((g) => g.status === 'active' || g.id === homework?.groupId)
  const [form, setForm] = useState<HomeworkInput>(() => ({
    groupId: homework?.groupId ?? (running.some((g) => g.id === defaultGroup) ? defaultGroup : (running[0]?.id ?? '')),
    title: homework?.title ?? '',
    description: homework?.description ?? '',
    dueDate: homework?.dueDate ?? toISODate(addDays(now, 2)),
  }))
  const [errors, setErrors] = useState<Errors>({})

  const update = <K extends keyof HomeworkInput>(key: K, value: HomeworkInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    if (!form.groupId) e.groupId = 'Choose a group.'
    if (form.title.trim().length < 3) e.title = 'Give the homework a short title.'
    if (form.description.trim().length < 5) e.description = 'Describe what students should do.'
    if (!isValidISODate(form.dueDate)) e.dueDate = 'Choose a deadline.'
    else if (!homework && form.dueDate < toISODate(now)) e.dueDate = 'The deadline can’t be in the past.'
    setErrors(e)
    if (Object.keys(e).length) return

    const input = { ...form, title: form.title.trim(), description: form.description.trim() }
    const ok = homework ? actions.updateHomework(homework.id, input) : actions.addHomework(input) !== null
    if (!ok) {
      toast.show('Homework wasn’t saved: you can only set homework for your own groups.', 'error')
      return
    }
    toast.show(homework ? `Saved “${input.title}”.` : `Homework set for ${data.groups.find((g) => g.id === input.groupId)?.name}.`)
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Group" error={errors.groupId}>
        {(control) => (
          <Select {...control} value={form.groupId} onChange={(e) => update('groupId', e.target.value)}>
            {running.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Title" error={errors.title}>
        {(control) => <Input {...control} value={form.title} maxLength={120} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Unit 7 vocabulary" />}
      </Field>
      <Field label="Description" error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            rows={5}
            maxLength={2000}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What should students do, and how should they bring it to class?"
          />
        )}
      </Field>
      <Field label="Deadline" error={errors.dueDate}>
        {(control) => <Input {...control} type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} className="sm:w-48" />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {homework ? 'Save changes' : 'Set homework'}
        </Button>
      </div>
    </form>
  )
}

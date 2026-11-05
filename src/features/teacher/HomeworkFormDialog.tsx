import { useState, type FormEvent } from 'react'
import type { Homework } from '../../types'
import { useSchool, type HomeworkInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { addDays, isValidISODate, toISODate } from '../../lib/dates'
import { tr } from '../../i18n'

interface Props {
  open: boolean
  onClose: () => void
  homework?: Homework
  defaultGroup?: string
  /** Called with the new or updated homework id. */
  onSaved?: (id: string) => void
}

export function HomeworkFormDialog({ open, onClose, homework, defaultGroup = '', onSaved }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={homework ? tr("Edit homework") : tr("New homework")}
      description={homework ? undefined : tr("Everyone in the group gets this homework and a row in its evaluation table.")}
    >
      {open && <HomeworkForm homework={homework} defaultGroup={defaultGroup} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

type Errors = Partial<Record<keyof HomeworkInput, string>>

function HomeworkForm({ homework, defaultGroup, onClose, onSaved }: Omit<Props, 'open'> & { defaultGroup: string }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const running = data.groups.filter((g) => g.status === 'active' || g.id === homework?.groupId)
  const [form, setForm] = useState<HomeworkInput>(() => ({
    groupId: homework?.groupId ?? (running.some((g) => g.id === defaultGroup) ? defaultGroup : (running[0]?.id ?? '')),
    title: homework?.title ?? '',
    description: homework?.description ?? '',
    resource: homework?.resource ?? '',
    dueDate: homework?.dueDate ?? toISODate(addDays(now, 2)),
  }))
  const [errors, setErrors] = useState<Errors>({})
  const group = data.groups.find((g) => g.id === form.groupId)

  const update = <K extends keyof HomeworkInput>(key: K, value: HomeworkInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    if (!form.groupId) e.groupId = tr("Choose a group.")
    if (form.title.trim().length < 3) e.title = tr("Give the homework a short title.")
    if (form.description.trim().length < 5) e.description = tr("Describe what students should do.")
    if (!isValidISODate(form.dueDate)) e.dueDate = tr("Choose a deadline.")
    else if (!homework && form.dueDate < toISODate(now)) e.dueDate = tr("The deadline can’t be in the past.")
    else if (homework && form.dueDate < homework.assignedOn) e.dueDate = tr("The deadline can’t be before the day it was set.")
    setErrors(e)
    if (Object.keys(e).length) return

    const input = { ...form, title: form.title.trim(), description: form.description.trim(), resource: form.resource?.trim() || undefined }
    if (homework) {
      if (!actions.updateHomework(homework.id, input)) {
        toast.show(tr("Homework wasn’t saved: you can only edit homework for your own groups."), 'error')
        return
      }
      toast.show(tr("Saved “{0}”.", input.title))
      onSaved?.(homework.id)
    } else {
      const created = actions.addHomework(input)
      if (!created) {
        toast.show(tr("Homework wasn’t saved: you can only set homework for your own groups."), 'error')
        return
      }
      toast.show(tr("Homework set for {0}: {1} students.", group?.name, created.studentIds.length))
      onSaved?.(created.id)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("Group")} error={errors.groupId} hint={homework ? tr("The group can’t change once homework is set.") : group?.subject}>
          {(control) => (
            <Select {...control} value={form.groupId} disabled={Boolean(homework)} onChange={(e) => update('groupId', e.target.value)}>
              {running.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={tr("Deadline")} error={errors.dueDate}>
          {(control) => <Input {...control} type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />}
        </Field>
      </div>
      <Field label={tr("Title")} error={errors.title}>
        {(control) => <Input {...control} value={form.title} maxLength={120} onChange={(e) => update('title', e.target.value)} placeholder={tr("e.g. Unit 7 vocabulary")} />}
      </Field>
      <Field label={tr("Description")} error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            rows={5}
            maxLength={2000}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder={tr("What should students do, and how should they hand it in?")}
          />
        )}
      </Field>
      <Field label={tr("Resource")} optional hint={tr("A page reference or a link, e.g. “Workbook pp. 40–42”.")}>
        {(control) => <Input {...control} value={form.resource ?? ''} maxLength={300} onChange={(e) => update('resource', e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {homework ? tr("Save changes") : tr("Set homework")}
        </Button>
      </div>
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import type { Assessment, AssessmentKind } from '../../types'
import { ASSESSMENT_KINDS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { isValidISODate, toISODate } from '../../lib/dates'
import { assessmentKindLabel } from '../../lib/assessments'

interface Props {
  open: boolean
  onClose: () => void
  assessment?: Assessment
  defaultGroup?: string
  onSaved?: (id: string) => void
}

export function AssessmentFormDialog({ open, onClose, assessment, defaultGroup, onSaved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={assessment ? 'Edit assessment' : 'New assessment'} description={assessment ? undefined : 'A test for one group. Enter results now or after the test.'}>
      {open && <AssessmentForm assessment={assessment} defaultGroup={defaultGroup} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

function AssessmentForm({ assessment, defaultGroup = '', onClose, onSaved }: Omit<Props, 'open'>) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const groups = data.groups.filter((g) => g.status === 'active' || g.id === assessment?.groupId)
  const [form, setForm] = useState({
    groupId: assessment?.groupId ?? (groups.some((g) => g.id === defaultGroup) ? defaultGroup : (groups[0]?.id ?? '')),
    title: assessment?.title ?? '',
    kind: (assessment?.kind ?? 'monthly') as AssessmentKind,
    date: assessment?.date ?? toISODate(now),
    maxScore: String(assessment?.maxScore ?? 100),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Record<string, string> = {}
    const max = Number(form.maxScore)
    if (!form.groupId) e.groupId = 'Choose a group.'
    if (!isValidISODate(form.date)) e.date = 'Choose the date.'
    if (!Number.isInteger(max) || max < 1 || max > 1000) e.maxScore = 'Enter a whole number, e.g. 100 or 50.'
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    const input = { groupId: form.groupId, title: form.title.trim() || assessmentKindLabel[form.kind], kind: form.kind, date: form.date, maxScore: max }
    if (assessment) {
      if (!actions.updateAssessment(assessment.id, input)) return toast.show('Not saved: you can only change assessments for your groups.', 'error')
      toast.show('Assessment saved.')
      onSaved?.(assessment.id)
    } else {
      const created = actions.addAssessment(input)
      if (!created) return toast.show('Not saved: you can only add assessments for your groups.', 'error')
      toast.show(`${created.title} added for ${data.groups.find((g) => g.id === created.groupId)?.name}.`)
      onSaved?.(created.id)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Group" error={errors.groupId} className="sm:col-span-2" hint={assessment ? 'The group can’t change once results exist.' : undefined}>
        {(p) => (
          <Select {...p} value={form.groupId} disabled={Boolean(assessment)} onChange={(e) => set('groupId', e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.subject})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Type">
        {(p) => (
          <Select {...p} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {ASSESSMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {assessmentKindLabel[k]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Title" optional hint="Leave empty to use the type.">
        {(p) => <Input {...p} value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder={assessmentKindLabel[form.kind]} />}
      </Field>
      <Field label="Date" error={errors.date}>
        {(p) => <Input {...p} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />}
      </Field>
      <Field label="Maximum score" error={errors.maxScore}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={form.maxScore} onChange={(e) => set('maxScore', e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {assessment ? 'Save' : 'Add assessment'}
        </Button>
      </div>
    </form>
  )
}

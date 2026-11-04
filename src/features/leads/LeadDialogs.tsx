import { useState, type FormEvent } from 'react'
import type { Lead } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { isValidISODate, toISODate } from '../../lib/dates'
import { formatPhone, isValidPhone } from '../../lib/format'
import { LEAD_SOURCES, LOST_REASONS } from '../../lib/admissions'
import { cn } from '../../lib/cn'

function Footer({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary">
        {label}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------- new / edit enquiry

export function LeadFormDialog({ open, onClose, lead, onSaved }: { open: boolean; onClose: () => void; lead?: Lead; onSaved?: (id: string) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={lead ? 'Edit enquiry' : 'New enquiry'} description={lead ? lead.studentName : 'Someone interested in studying. Just the basics: you can add the rest later.'}>
      {open && <LeadForm lead={lead} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

function LeadForm({ lead, onClose, onSaved }: { lead?: Lead; onClose: () => void; onSaved?: (id: string) => void }) {
  const { data, actions } = useSchool()
  const toast = useToast()
  const courses = data.courses.filter((c) => c.active || c.name === lead?.course)
  const [form, setForm] = useState({
    studentName: lead?.studentName ?? '',
    parentName: lead?.parentName ?? '',
    phone: lead?.phone ?? '',
    course: lead?.course ?? courses[0]?.name ?? '',
    source: lead?.source ?? '',
    notes: lead?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Record<string, string> = {}
    if (form.studentName.trim().length < 2) e.studentName = 'Enter the name of the person who wants to study.'
    if (!isValidPhone(form.phone)) e.phone = 'Enter a phone like +998 90 123 45 67.'
    if (!form.course) e.course = 'Choose a course.'
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    const input = {
      studentName: form.studentName.trim().replace(/\s+/g, ' '),
      parentName: form.parentName.trim() || undefined,
      phone: formatPhone(form.phone),
      course: form.course,
      source: form.source || undefined,
      notes: form.notes.trim() || undefined,
    }
    if (lead) {
      actions.updateLead(lead.id, input)
      toast.show('Enquiry saved.')
      onSaved?.(lead.id)
    } else {
      const created = actions.addLead(input)
      toast.show(`Enquiry from ${created.studentName} added.`)
      onSaved?.(created.id)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Student’s name" error={errors.studentName}>
        {(p) => <Input {...p} autoFocus value={form.studentName} onChange={(e) => set('studentName', e.target.value)} placeholder="e.g. Aziz Karimov" />}
      </Field>
      <Field label="Parent’s name" optional>
        {(p) => <Input {...p} value={form.parentName} onChange={(e) => set('parentName', e.target.value)} placeholder="Leave empty for adults" />}
      </Field>
      <Field label="Phone" error={errors.phone}>
        {(p) => <Input {...p} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => set('phone', formatPhone(form.phone))} placeholder="+998 90 123 45 67" />}
      </Field>
      <Field label="Interested in" error={errors.course}>
        {(p) => (
          <Select {...p} value={form.course} onChange={(e) => set('course', e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="How they heard about us" optional>
        {(p) => (
          <Select {...p} value={form.source} onChange={(e) => set('source', e.target.value)}>
            <option value="">Not asked</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Notes" optional className="sm:col-span-2">
        {(p) => <Textarea {...p} rows={3} value={form.notes} maxLength={500} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. Wants evening classes, asked about the price for two children" />}
      </Field>
      <Footer onClose={onClose} label={lead ? 'Save' : 'Add enquiry'} />
    </form>
  )
}

// ---------------------------------------------------------------- trial lesson

export function TrialDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead }) {
  return (
    <Dialog open={open} onClose={onClose} title={lead.trial ? 'Change trial lesson' : 'Schedule a trial lesson'} description={`${lead.studentName} · ${lead.course}`}>
      {open && <TrialForm lead={lead} onClose={onClose} />}
    </Dialog>
  )
}

function TrialForm({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const groups = data.groups.filter((g) => g.status === 'active').sort((a, b) => Number(b.subject === lead.course) - Number(a.subject === lead.course) || a.name.localeCompare(b.name))
  const [form, setForm] = useState({ date: lead.trial?.date ?? toISODate(now), time: lead.trial?.time ?? '', groupId: lead.trial?.groupId ?? '' })
  const [error, setError] = useState('')
  const group = data.groups.find((g) => g.id === form.groupId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!isValidISODate(form.date) || form.date < toISODate(now)) return setError('Choose today or a later date.')
    if (!/^\d\d:\d\d$/.test(form.time)) return setError('Choose a time.')
    actions.updateLead(lead.id, {
      stage: 'trial_scheduled',
      trial: { date: form.date, time: form.time, groupId: group?.id, teacherId: group?.teacherId, attended: null },
    })
    toast.show(`Trial lesson booked for ${lead.studentName}.`)
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Sit in on group" optional hint="Choosing a group fills in its time and teacher." className="sm:col-span-2">
        {(p) => (
          <Select
            {...p}
            value={form.groupId}
            onChange={(e) => {
              const g = data.groups.find((x) => x.id === e.target.value)
              setForm((f) => ({ ...f, groupId: e.target.value, time: g?.startTime ?? f.time }))
            }}
          >
            <option value="">No group: a separate meeting</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.subject}, {g.startTime})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Date" error={error || undefined}>
        {(p) => <Input {...p} type="date" min={toISODate(now)} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />}
      </Field>
      <Field label="Time">
        {(p) => <Input {...p} type="time" step={300} value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />}
      </Field>
      {group && (
        <p className="text-sm text-ink-muted sm:col-span-2">
          With {data.teachers.find((t) => t.id === group.teacherId)?.fullName ?? 'the group’s teacher'} in {group.room}.
        </p>
      )}
      <Footer onClose={onClose} label={lead.trial ? 'Save' : 'Book trial'} />
    </form>
  )
}

// ---------------------------------------------------------------- trial result and placement

export function TrialResultDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead }) {
  return (
    <Dialog open={open} onClose={onClose} title="Trial result and placement" description={`${lead.studentName} · ${lead.course}`} size="lg">
      {open && <TrialResultForm lead={lead} onClose={onClose} />}
    </Dialog>
  )
}

function TrialResultForm({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const [attended, setAttended] = useState<boolean>(lead.trial?.attended ?? true)
  const [form, setForm] = useState({
    outcome: lead.trial?.outcome ?? '',
    level: lead.placement?.level ?? '',
    score: lead.placement?.score ?? '',
    recommendedGroupId: lead.placement?.recommendedGroupId ?? lead.trial?.groupId ?? '',
    notes: lead.placement?.notes ?? '',
  })
  const [error, setError] = useState('')
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const groups = data.groups.filter((g) => g.status === 'active').sort((a, b) => Number(b.subject === lead.course) - Number(a.subject === lead.course) || a.name.localeCompare(b.name))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trial = lead.trial ?? { date: toISODate(now), time: '00:00', attended: null }
    if (!attended) {
      // A no-show goes back to "contacted" so someone calls to rebook.
      actions.updateLead(lead.id, { stage: 'contacted', trial: { ...trial, attended: false, outcome: form.outcome.trim() || 'Did not come' } })
      toast.show(`${lead.studentName} marked as not attending. Call to rebook.`)
      return onClose()
    }
    if (form.level.trim().length < 1) return setError('Enter the level they were placed at.')
    actions.updateLead(lead.id, {
      stage: 'trial_done',
      trial: { ...trial, attended: true, outcome: form.outcome.trim() || undefined },
      placement: {
        level: form.level.trim(),
        score: form.score.trim() || undefined,
        recommendedGroupId: form.recommendedGroupId || undefined,
        notes: form.notes.trim() || undefined,
        on: trial.date <= toISODate(now) ? trial.date : toISODate(now),
      },
    })
    toast.show(`Result saved for ${lead.studentName}. Next: enroll them.`)
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">Did they come?</legend>
        <div className="flex gap-2">
          {[
            [true, 'Yes, they came'],
            [false, 'No, they didn’t come'],
          ].map(([value, label]) => (
            <label key={String(value)} className="relative">
              <input type="radio" name="attended" className="peer sr-only" checked={attended === value} onChange={() => setAttended(value as boolean)} />
              <span
                className={cn(
                  'flex h-9 cursor-pointer items-center rounded-control border border-line-strong px-3 text-sm text-ink-muted select-none hover:bg-subtle',
                  'peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
                )}
              >
                {label as string}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="How it went" optional className="sm:col-span-2">
        {(p) => <Input {...p} value={form.outcome} maxLength={200} onChange={(e) => set('outcome', e.target.value)} placeholder={attended ? 'e.g. Engaged, followed the lesson well' : 'e.g. Ill, wants another day'} />}
      </Field>
      {attended && (
        <>
          <Field label="Placement level" error={error || undefined}>
            {(p) => (
              <Input
                {...p}
                value={form.level}
                maxLength={60}
                onChange={(e) => {
                  set('level', e.target.value)
                  setError('')
                }}
                placeholder="e.g. Pre-Intermediate, Band 5.5"
              />
            )}
          </Field>
          <Field label="Test score" optional>
            {(p) => <Input {...p} value={form.score} maxLength={30} onChange={(e) => set('score', e.target.value)} placeholder="e.g. 34/50" />}
          </Field>
          <Field label="Recommended group" optional className="sm:col-span-2">
            {(p) => (
              <Select {...p} value={form.recommendedGroupId} onChange={(e) => set('recommendedGroupId', e.target.value)}>
                <option value="">Not decided yet</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.subject}, {g.startTime})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Placement notes" optional className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} value={form.notes} maxLength={400} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. Strong reading, needs speaking practice" />}
          </Field>
        </>
      )}
      <Footer onClose={onClose} label="Save result" />
    </form>
  )
}

// ---------------------------------------------------------------- lost

export function LostDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead }) {
  const { actions } = useSchool()
  const toast = useToast()
  const [reason, setReason] = useState(LOST_REASONS[0])
  const [other, setOther] = useState('')
  return (
    <Dialog open={open} onClose={onClose} title="Mark as lost" description={`${lead.studentName} won’t be joining for now. The enquiry stays on record and can be reopened.`} size="sm">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          actions.updateLead(lead.id, { stage: 'lost', lostReason: reason === 'Other' ? other.trim() || 'Other' : reason })
          toast.show(`${lead.studentName} marked as lost.`)
          onClose()
        }}
      >
        <Field label="Reason">
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
              {LOST_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
        </Field>
        {reason === 'Other' && (
          <Field label="Details">
            {(p) => <Input {...p} value={other} maxLength={120} onChange={(e) => setOther(e.target.value)} />}
          </Field>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger">
            Mark as lost
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

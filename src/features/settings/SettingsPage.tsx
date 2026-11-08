import { useState, type FormEvent } from 'react'
import { Database, Download, HardDrive, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { Settings } from '../../types'
import { useSchool } from '../../data/school-context'
import { DEFAULT_SETTINGS } from '../../data/seed'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { toISODate } from '../../lib/dates'
import { formatNumber, formatPhone, formatRelative, isValidEmail, isValidPhone } from '../../lib/format'
import { CoursesPanel, RoomsPanel } from './CoursesAndRooms'
import { ListsPanel } from './ListsPanel'
import { tr } from '../../i18n'

type Errors = Partial<Record<keyof Settings, string>>

export function SettingsPage() {
  const { data, now, persistent, saving, user, actions } = useSchool()
  const toast = useToast()
  const [form, setForm] = useState<Settings>(data.settings)
  const [errors, setErrors] = useState<Errors>({})
  const [confirmReset, setConfirmReset] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    if (!form.centerName.trim()) e.centerName = tr("Enter the centre’s name.")
    if (!isValidPhone(form.phone)) e.phone = tr("Enter a phone number like +998 71 200 00 00.")
    if (!isValidEmail(form.email.trim())) e.email = tr("Enter a valid email address.")
    if (!form.address.trim()) e.address = tr("Enter the address.")
    if (!form.workingHours.trim()) e.workingHours = tr("Enter the working hours.")
    if (!Number.isInteger(form.tuitionDueDay) || form.tuitionDueDay < 1 || form.tuitionDueDay > 28) e.tuitionDueDay = tr("Choose a day between 1 and 28.")
    setErrors(e)
    if (Object.keys(e).length) return
    const next = { ...form, centerName: form.centerName.trim(), phone: formatPhone(form.phone), email: form.email.trim(), address: form.address.trim(), workingHours: form.workingHours.trim() }
    actions.updateSettings(next)
    setForm(next)
    toast.show(tr("Settings saved."))
  }

  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sherov-school-demo-data-${toISODate(now)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Counts are for the administrator's own branch.
  const counts: [string, number][] = [
    [tr("Students in your branch"), data.students.length],
    [tr("Teachers"), data.teachers.length],
    [tr("Groups"), data.groups.length],
    [tr("Payments"), data.payments.length],
    [tr("Attendance records"), data.attendance.length],
  ]

  return (
    <>
      <PageHeader
        title={tr("Settings")}
        description={tr("Centre details, the courses you offer, your branch’s rooms, and the demo data.")}
        actions={
          <ButtonLink to="/settings/general" variant="primary">
            <SlidersHorizontal aria-hidden />
            {tr("General settings")}
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={tr("Centre details")}>
          <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("Centre name")} error={errors.centerName} className="sm:col-span-2">
              {(p) => <Input {...p} value={form.centerName} onChange={(e) => set('centerName', e.target.value)} />}
            </Field>
            <Field label={tr("Phone")} error={errors.phone}>
              {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
            </Field>
            <Field label={tr("Email")} error={errors.email}>
              {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}
            </Field>
            <Field label={tr("Address")} error={errors.address} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />}
            </Field>
            <Field label={tr("Working hours")} error={errors.workingHours}>
              {(p) => <Input {...p} value={form.workingHours} onChange={(e) => set('workingHours', e.target.value)} />}
            </Field>
            <Field label={tr("Tuition due by day")} error={errors.tuitionDueDay} hint={tr("Unpaid tuition counts as overdue after this day of the month.")}>
              {(p) => <Input {...p} type="number" min={1} max={28} value={form.tuitionDueDay} onChange={(e) => set('tuitionDueDay', Number(e.target.value))} />}
            </Field>
            <Field label={tr("Currency")} hint={tr("All amounts are in Uzbekistani som. Other currencies aren’t supported yet.")} className="sm:col-span-2">
              {(p) => <Input {...p} value="UZS, Uzbekistani som" disabled readOnly />}
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4 sm:col-span-2">
              {dirty && <p className="mr-auto text-sm text-warning">{tr("Unsaved changes")}</p>}
              <Button onClick={() => setForm(data.settings)} disabled={!dirty}>
                {tr("Discard")}
              </Button>
              <Button type="submit" variant="primary" disabled={!dirty}>
                {tr("Save settings")}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel id="demo-data" title={tr("Data")}>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3 rounded-control bg-subtle px-3 py-3">
              <HardDrive aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <div>
                <p className="font-medium text-ink">{!persistent ? tr("Not connected to the database") : saving ? tr("Saving…") : tr("Saved in the database")}</p>
                <p className="text-ink-muted">
                  {persistent ? tr("Every change is saved online straight away and shared with everyone who works here, on any device. Old versions of changed or deleted records are kept, so mistakes can be undone.") : tr("The server can’t be reached right now. Check the internet connection.")}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-line">
              {counts.map(([label, n]) => (
                <div key={label} className="flex justify-between py-2">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="num font-medium">{formatNumber(n)}</dd>
                </div>
              ))}
              <div className="flex justify-between py-2">
                <dt className="text-ink-muted">{tr("Sample data created")}</dt>
                <dd>{formatRelative(data.seededAt, now)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button onClick={backup}>
                <Download aria-hidden />
                {tr("Download a copy (JSON)")}
              </Button>
              {user?.role === 'owner' && (
                <Button variant="ghost" onClick={() => setConfirmReset(true)} className="text-danger hover:bg-danger-soft hover:text-danger">
                  <RotateCcw aria-hidden />
                  {tr("Load sample data")}
                </Button>
              )}
            </div>
            <p className="flex gap-2 text-xs text-ink-muted">
              <Database aria-hidden className="size-3.5 shrink-0" />
              {tr("Sample data is for testing only. Before the centre starts using this for real, it will be cleared.")}
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <CoursesPanel />
        <RoomsPanel />
      </div>

      <div className="mt-6">
        <ListsPanel />
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={tr("Replace everything with sample data?")}
        confirmLabel={tr("Load sample data")}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          actions.resetDemoData()
          setForm(DEFAULT_SETTINGS)
          toast.show(tr("Sample data is being saved. This takes a few seconds."))
        }}
      >
        <p>
          {tr("Everything in the database will be replaced, for every branch and every person: students, teachers, groups, payments, attendance, homework and settings. Fresh sample data dated today takes its place. Never do this once real data is in use.")}
        </p>
        <p>{tr("If you might need your changes, download a copy first.")}</p>
      </ConfirmDialog>
    </>
  )
}

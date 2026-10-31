import { useState, type FormEvent } from 'react'
import { Database, Download, HardDrive, RotateCcw } from 'lucide-react'
import type { Settings } from '../../types'
import { useSchool } from '../../data/school-context'
import { DEFAULT_SETTINGS } from '../../data/seed'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { toISODate } from '../../lib/dates'
import { formatNumber, formatPhone, formatRelative, isValidEmail, isValidPhone } from '../../lib/format'

type Errors = Partial<Record<keyof Settings, string>>

export function SettingsPage() {
  const { data, now, persistent, actions } = useSchool()
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
    if (!form.centerName.trim()) e.centerName = 'Enter the centre’s name.'
    if (!isValidPhone(form.phone)) e.phone = 'Enter a phone number like +998 71 200 00 00.'
    if (!isValidEmail(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!form.address.trim()) e.address = 'Enter the address.'
    if (!form.workingHours.trim()) e.workingHours = 'Enter the working hours.'
    if (!Number.isInteger(form.tuitionDueDay) || form.tuitionDueDay < 1 || form.tuitionDueDay > 28) e.tuitionDueDay = 'Choose a day between 1 and 28.'
    setErrors(e)
    if (Object.keys(e).length) return
    const next = { ...form, centerName: form.centerName.trim(), phone: formatPhone(form.phone), email: form.email.trim(), address: form.address.trim(), workingHours: form.workingHours.trim() }
    actions.updateSettings(next)
    setForm(next)
    toast.show('Settings saved.')
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

  const sizeKb = Math.round(new Blob([JSON.stringify(data)]).size / 1024)
  // Counts are for the administrator's own branch.
  const counts: [string, number][] = [
    ['Students in your branch', data.students.length],
    ['Teachers', data.teachers.length],
    ['Groups', data.groups.length],
    ['Payments', data.payments.length],
    ['Attendance records', data.attendance.length],
  ]

  return (
    <>
      <PageHeader title="Settings" description="Centre details used across the app, and controls for the demo data." />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Centre details">
          <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="Centre name" error={errors.centerName} className="sm:col-span-2">
              {(p) => <Input {...p} value={form.centerName} onChange={(e) => set('centerName', e.target.value)} />}
            </Field>
            <Field label="Phone" error={errors.phone}>
              {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
            </Field>
            <Field label="Email" error={errors.email}>
              {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}
            </Field>
            <Field label="Address" error={errors.address} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />}
            </Field>
            <Field label="Working hours" error={errors.workingHours}>
              {(p) => <Input {...p} value={form.workingHours} onChange={(e) => set('workingHours', e.target.value)} />}
            </Field>
            <Field label="Tuition due by day" error={errors.tuitionDueDay} hint="Unpaid tuition counts as overdue after this day of the month.">
              {(p) => <Input {...p} type="number" min={1} max={28} value={form.tuitionDueDay} onChange={(e) => set('tuitionDueDay', Number(e.target.value))} />}
            </Field>
            <Field label="Currency" hint="All amounts are in Uzbekistani som. Other currencies aren’t supported yet." className="sm:col-span-2">
              {(p) => <Input {...p} value="UZS, Uzbekistani som" disabled readOnly />}
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4 sm:col-span-2">
              {dirty && <p className="mr-auto text-sm text-warning">Unsaved changes</p>}
              <Button onClick={() => setForm(data.settings)} disabled={!dirty}>
                Discard
              </Button>
              <Button type="submit" variant="primary" disabled={!dirty}>
                Save settings
              </Button>
            </div>
          </form>
        </Panel>

        <Panel id="demo-data" title="Demo data">
          <div className="space-y-4 text-sm">
            <div className="flex gap-3 rounded-control bg-subtle px-3 py-3">
              <HardDrive aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <div>
                <p className="font-medium text-ink">{persistent ? 'Saved in this browser only' : 'Not being saved'}</p>
                <p className="text-ink-muted">
                  {persistent
                    ? 'Changes are kept in this browser’s local storage. They are not sent to a server, not backed up, and not shared with other devices or people.'
                    : 'This browser is blocking local storage, so changes disappear when you refresh.'}
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
                <dt className="text-ink-muted">Sample data created</dt>
                <dd>{formatRelative(data.seededAt, now)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-ink-muted">Storage used</dt>
                <dd className="num">{formatNumber(sizeKb)} KB</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button onClick={backup}>
                <Download aria-hidden />
                Download a copy (JSON)
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(true)} className="text-danger hover:bg-danger-soft hover:text-danger">
                <RotateCcw aria-hidden />
                Reset demo data
              </Button>
            </div>
            <p className="flex gap-2 text-xs text-ink-muted">
              <Database aria-hidden className="size-3.5 shrink-0" />
              A real database and sign-in will replace this once the design is approved.
            </p>
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        confirmLabel="Reset demo data"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          actions.resetDemoData()
          setForm(DEFAULT_SETTINGS)
          toast.show('Demo data was reset to fresh sample data.')
        }}
      >
        <p>
          Every change made in this browser will be lost, for all three branches and every demo account: students, teachers, groups, payments, attendance, homework and settings you added or edited. The app will start again with fresh
          sample data dated today.
        </p>
        <p>If you might need your changes, download a copy first.</p>
      </ConfirmDialog>
    </>
  )
}

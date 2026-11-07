import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, Check, Pencil, Trash2, X } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { toneDot, type Tone } from '../../components/ui/tone'
import { LEAD_STAGE_COLORS } from '../../types'
import { cn } from '../../lib/cn'
import { toISODate } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import {
  generalSettings,
  reasonError,
  REASON_EVENTS,
  RECEIPT_FIELDS,
  TOGGLE_GROUPS,
  type GeneralSettings,
  type GeneralToggles,
  type Holiday,
  type Reason,
  type ReasonEvent,
  type ReceiptField,
} from '../../lib/general-settings'
import { tr } from '../../i18n'

type Tab = 'general' | 'reasons' | 'holidays' | 'receipt'

const TOGGLE_LABEL: Record<keyof GeneralToggles, string> = {
  discountAffectsTeacher: tr("Discounts reduce the teacher’s share"),
  receiptAfterPayment: tr("Print a receipt after each payment"),
  choosePaymentDate: tr("Choose the date when recording a payment"),
  askDiscountOnPayment: tr("Offer to add a discount when a student pays"),
  discountCategories: tr("Pick a category for each discount"),
  teacherSeesOwnSalary: tr("Teachers can see their own salary"),
  teacherSeesSalaryReport: tr("Teachers can see the salary report"),
  alertMissingAttendance: tr("Notify when a teacher hasn’t taken attendance"),
  teacherSeesStudentData: tr("Teachers can see students’ contact details"),
  leadSmsVerify: tr("Confirm new leads’ phone numbers by SMS"),
}

const GROUP_LABEL = { payments: tr("Payments"), teachers: tr("Teachers"), leads: tr("Leads") }

const EVENT_LABEL: Record<ReasonEvent, string> = {
  absent: tr("Student absent"),
  removedActive: tr("Active student removed"),
  removedTrial: tr("Trial student removed"),
  removedFrozen: tr("Frozen student removed"),
  returnedToTrial: tr("Returned to trial"),
  frozen: tr("Student frozen"),
  leadRemoved: tr("Lead removed"),
  removedFromGroup: tr("Removed from a group"),
}

const RECEIPT_LABEL: Record<ReceiptField, string> = {
  receiptNo: tr("Receipt number"),
  amount: tr("Amount"),
  method: tr("Payment method"),
  group: tr("Group"),
  staff: tr("Recorded by"),
  teacher: tr("Teacher"),
  student: tr("Student"),
  time: tr("Date and time"),
  centerName: tr("Centre name"),
  note: tr("Note"),
}

const TONE_LABEL: Record<Tone, string> = {
  neutral: tr("Grey"),
  brand: tr("Green"),
  accent: tr("Purple"),
  info: tr("Blue"),
  success: tr("Teal"),
  warning: tr("Amber"),
  danger: tr("Red"),
}

/** Settings → General: LC UP's "Umumiy sozlamalar", reasons, holidays and receipt, in one place. */
export function GeneralSettingsPage() {
  const { data, actions } = useSchool()
  const [params, setParams] = useSearchParams()
  const asked = params.get('tab')
  const tab: Tab = asked === 'reasons' || asked === 'holidays' || asked === 'receipt' ? asked : 'general'
  const setTab = (t: Tab) => setParams(t === 'general' ? {} : { tab: t }, { replace: true })
  const g = generalSettings(data.settings)
  const save = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) =>
    actions.updateSettings({ ...data.settings, general: { ...g, [key]: value } })

  const tabs: [Tab, string][] = [
    ['general', tr("General")],
    ['reasons', tr("Reasons")],
    ['holidays', tr("Holidays")],
    ['receipt', tr("Receipt")],
  ]

  return (
    <>
      <Link to="/settings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {tr("Settings")}
      </Link>
      <PageHeader title={tr("General settings")} description={tr("How the centre works: switches, reasons, holidays and what a receipt shows. Shared by every branch; changes save straight away.")} />
      <div role="tablist" aria-label={tr("Which settings")} className="mb-5 flex flex-wrap gap-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('rounded-full px-4 py-1.5 text-sm', tab === key ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'general' && <TogglesTab toggles={g.toggles} onChange={(v) => save('toggles', v)} />}
      {tab === 'reasons' && <ReasonsTab reasons={g.reasons} onChange={(v) => save('reasons', v)} />}
      {tab === 'holidays' && <HolidaysTab holidays={g.holidays} onChange={(v) => save('holidays', v)} />}
      {tab === 'receipt' && <ReceiptTab fields={g.receipt} centerName={data.settings.centerName} onChange={(v) => save('receipt', v)} />}
    </>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-brand' : 'bg-line-strong')}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  )
}

function SwitchRow({ label, hint, checked, onChange, indent }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; indent?: boolean }) {
  return (
    <li className={cn('flex items-center justify-between gap-4 py-3', indent && 'pl-6')}>
      <div>
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </li>
  )
}

function TogglesTab({ toggles, onChange }: { toggles: GeneralToggles; onChange: (v: GeneralToggles) => void }) {
  const toast = useToast()
  return (
    <div className="grid items-start gap-6 xl:grid-cols-3">
      {TOGGLE_GROUPS.map(({ group, keys }) => (
        <Panel key={group} title={GROUP_LABEL[group]} description={group === 'payments' ? tr("Saved now and applied when payment calculations are switched on.") : undefined}>
          <ul className="divide-y divide-line">
            {keys.map((k) => (
              <SwitchRow
                key={k}
                label={TOGGLE_LABEL[k]}
                checked={toggles[k]}
                onChange={(v) => {
                  onChange({ ...toggles, [k]: v })
                  toast.show(v ? tr("Turned on: {0}", TOGGLE_LABEL[k]) : tr("Turned off: {0}", TOGGLE_LABEL[k]))
                }}
              />
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  )
}

function ToneSelect({ value, onChange, label }: { value: Tone; onChange: (t: Tone) => void; label: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Tone)} className="h-8 w-32">
      {LEAD_STAGE_COLORS.map((t) => (
        <option key={t} value={t}>
          {TONE_LABEL[t]}
        </option>
      ))}
    </Select>
  )
}

function ReasonsTab({ reasons, onChange }: { reasons: GeneralSettings['reasons']; onChange: (v: GeneralSettings['reasons']) => void }) {
  const toast = useToast()
  const { now } = useSchool()
  const [event, setEvent] = useState<ReasonEvent>('absent')
  const [text, setText] = useState('')
  const [tone, setTone] = useState<Tone>('neutral')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [removing, setRemoving] = useState<Reason | null>(null)
  const list = reasons.lists[event]
  const setList = (next: Reason[]) => onChange({ ...reasons, lists: { ...reasons.lists, [event]: next } })
  const patch = (id: string, p: Partial<Reason>) => setList(list.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const add = (e: FormEvent) => {
    e.preventDefault()
    const err = reasonError(list, text)
    if (err) return setError(tr(err))
    const clean = text.trim().replace(/\s+/g, ' ')
    const reason: Reason = { id: `rsn_${Date.now().toString(36)}`, text: clean, tone, createdAt: toISODate(now) }
    if (event === 'absent') Object.assign(reason, { chargesStudent: false, limitsTeacherShare: false })
    setList([...list, reason])
    setText('')
    toast.show(tr("Reason “{0}” added.", clean))
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Panel title={tr("When to ask for a reason")} description={tr("If a switch is on, staff must pick a reason before saving.")}>
        <ul className="divide-y divide-line">
          {REASON_EVENTS.map((ev) => (
            <div key={ev}>
              <SwitchRow label={EVENT_LABEL[ev]} checked={reasons.required[ev]} onChange={(v) => onChange({ ...reasons, required: { ...reasons.required, [ev]: v } })} />
              {ev === 'absent' && reasons.required.absent && (
                <SwitchRow indent label={tr("Teachers can add the reason while taking attendance")} checked={reasons.teacherAddsAbsenceReason} onChange={(v) => onChange({ ...reasons, teacherAddsAbsenceReason: v })} />
              )}
            </div>
          ))}
        </ul>
      </Panel>

      <Panel title={tr("Reason lists")} flush>
        <div role="tablist" aria-label={tr("Which event")} className="flex flex-wrap gap-1 border-t border-line px-4 pt-3">
          {REASON_EVENTS.map((ev) => (
            <button
              key={ev}
              type="button"
              role="tab"
              aria-selected={event === ev}
              onClick={() => {
                setEvent(ev)
                setError('')
                setEditing(null)
              }}
              className={cn('rounded-full px-3 py-1.5 text-sm', event === ev ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink')}
            >
              {EVENT_LABEL[ev]} <span className="opacity-70">{reasons.lists[ev].length}</span>
            </button>
          ))}
        </div>
        {event === 'absent' && <p className="px-5 pt-3 text-xs text-ink-muted">{tr("For absences you also choose whether the missed lesson is still charged, and whether the teacher still earns for it. These take effect when payment calculations are switched on.")}</p>}
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {list.length === 0 && <li className="px-5 py-4 text-sm text-ink-muted">{tr("No reasons yet. Add the first one below.")}</li>}
          {list.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 px-5 py-2 text-sm">
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', toneDot[x.tone])} />
              {editing?.id === x.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const err = reasonError(list, editing.text, x.id)
                    if (err) return toast.show(tr(err), 'error')
                    patch(x.id, { text: editing.text.trim().replace(/\s+/g, ' ') })
                    setEditing(null)
                  }}
                >
                  <Input aria-label={tr("New text for {0}", x.text)} autoFocus value={editing.text} onChange={(e) => setEditing({ id: x.id, text: e.target.value })} className="h-8 flex-1" />
                  <IconButton label={tr("Save")} type="submit">
                    <Check />
                  </IconButton>
                  <IconButton label={tr("Cancel")} onClick={() => setEditing(null)}>
                    <X />
                  </IconButton>
                </form>
              ) : (
                <>
                  <span className="min-w-32 flex-1 text-ink">{x.text}</span>
                  {event === 'absent' && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <input type="checkbox" checked={!!x.chargesStudent} onChange={(e) => patch(x.id, { chargesStudent: e.target.checked })} />
                        {tr("Charged")}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <input type="checkbox" checked={!!x.limitsTeacherShare} onChange={(e) => patch(x.id, { limitsTeacherShare: e.target.checked })} />
                        {tr("No teacher pay")}
                      </label>
                    </>
                  )}
                  <ToneSelect label={tr("Colour of {0}", x.text)} value={x.tone} onChange={(t) => patch(x.id, { tone: t })} />
                  <IconButton label={tr("Edit {0}", x.text)} onClick={() => setEditing({ id: x.id, text: x.text })}>
                    <Pencil />
                  </IconButton>
                  <IconButton label={tr("Remove {0}", x.text)} onClick={() => setRemoving(x)}>
                    <Trash2 />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={add} noValidate className="flex flex-wrap items-start gap-2 px-5 py-4">
          <Field label={tr("New reason for “{0}”", EVENT_LABEL[event])} error={error || undefined} className="min-w-48 flex-1">
            {(p) => (
              <Input
                {...p}
                value={text}
                maxLength={60}
                onChange={(e) => {
                  setText(e.target.value)
                  setError('')
                }}
              />
            )}
          </Field>
          <div className="mt-[1.6rem]">
            <ToneSelect label={tr("Colour")} value={tone} onChange={setTone} />
          </div>
          <Button type="submit" className="mt-[1.6rem]">
            {tr("Add")}
          </Button>
        </form>
      </Panel>

      <ConfirmDialog
        open={!!removing}
        title={tr("Remove this reason?")}
        confirmLabel={tr("Remove")}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return
          setList(list.filter((x) => x.id !== removing.id))
          toast.show(tr("Reason removed."))
        }}
      >
        <p>{tr("“{0}” won’t be offered any more. Records that already use it keep their text.", removing?.text ?? '')}</p>
      </ConfirmDialog>
    </div>
  )
}

function HolidaysTab({ holidays, onChange }: { holidays: Holiday[]; onChange: (v: Holiday[]) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [everyYear, setEveryYear] = useState(true)
  const [error, setError] = useState<{ name?: string; date?: string }>({})
  const [removing, setRemoving] = useState<Holiday | null>(null)
  const sorted = [...holidays].sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)))
  const patch = (id: string, p: Partial<Holiday>) => onChange(holidays.map((h) => (h.id === id ? { ...h, ...p } : h)))

  const add = (e: FormEvent) => {
    e.preventDefault()
    const err: typeof error = {}
    if (name.trim().length < 2) err.name = tr("Enter the holiday’s name.")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err.date = tr("Choose a date.")
    else if (holidays.some((h) => h.date === date || (everyYear && h.everyYear && h.date.slice(5) === date.slice(5)))) err.date = tr("There’s already a holiday on that day.")
    setError(err)
    if (Object.keys(err).length) return
    onChange([...holidays, { id: `hol_${Date.now().toString(36)}`, name: name.trim(), date, everyYear, affectsBalance: false }])
    toast.show(tr("Holiday “{0}” added.", name.trim()))
    setName('')
    setDate('')
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title={tr("Holidays")} description={tr("Days with no lessons. Turn on “No charge” and lessons that day won’t be charged to students once payment calculations are switched on.")} flush>
        <ul className="divide-y divide-line border-t border-line">
          {sorted.length === 0 && <li className="px-5 py-4 text-sm text-ink-muted">{tr("No holidays yet.")}</li>}
          {sorted.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-40 flex-1">
                <p className="font-medium text-ink">{h.name}</p>
                <p className="text-xs text-ink-muted">
                  {h.everyYear ? tr("Every year on {0}", formatDate(h.date).replace(/,?\s*\d{4}$/, '')) : formatDate(h.date)}
                </p>
              </div>
              {h.everyYear && <Badge tone="info">{tr("Yearly")}</Badge>}
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                {tr("No charge")}
                <Switch checked={h.affectsBalance} onChange={(v) => patch(h.id, { affectsBalance: v })} label={tr("No charge on {0}", h.name)} />
              </label>
              <IconButton label={tr("Remove {0}", h.name)} onClick={() => setRemoving(h)}>
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={tr("Add a holiday")}>
        <form onSubmit={add} noValidate className="grid gap-4">
          <Field label={tr("Name")} error={error.name}>
            {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Eid al-Fitr")} />}
          </Field>
          <Field label={tr("Date")} error={error.date}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={everyYear} onChange={(e) => setEveryYear(e.target.checked)} />
            {tr("Repeats every year on this day")}
          </label>
          <p className="text-xs text-ink-muted">{tr("Eid dates move each year, so add them without “Repeats every year”.")}</p>
          <Button type="submit" variant="primary">
            {tr("Add holiday")}
          </Button>
        </form>
      </Panel>
      <ConfirmDialog
        open={!!removing}
        title={tr("Remove this holiday?")}
        confirmLabel={tr("Remove")}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return
          onChange(holidays.filter((h) => h.id !== removing.id))
          toast.show(tr("Holiday removed."))
        }}
      >
        <p>{tr("Lessons on {0} will be treated as normal days.", removing?.name ?? '')}</p>
      </ConfirmDialog>
    </div>
  )
}

function ReceiptTab({ fields, centerName, onChange }: { fields: Record<ReceiptField, boolean>; centerName: string; onChange: (v: Record<ReceiptField, boolean>) => void }) {
  const sample: Record<ReceiptField, [string, string]> = {
    receiptNo: [tr("Receipt"), 'R-000128'],
    time: [tr("Date and time"), '07.11.2026 20:15'],
    student: [tr("Student"), 'Azamjon Qo‘chqorov'],
    teacher: [tr("Teacher"), 'Odilov Azizbek'],
    staff: [tr("Recorded by"), 'Administrator'],
    group: [tr("Group"), 'Beginner 4'],
    method: [tr("Payment method"), tr("Cash")],
    note: [tr("Note"), tr("Monthly payment")],
    amount: [tr("Amount"), '200 000 so‘m'],
    centerName: [tr("Centre name"), centerName],
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title={tr("What the receipt shows")} description={tr("Turn off anything you don’t want printed.")}>
        <ul className="divide-y divide-line">
          {RECEIPT_FIELDS.map((f) => (
            <SwitchRow key={f} label={RECEIPT_LABEL[f]} checked={fields[f]} onChange={(v) => onChange({ ...fields, [f]: v })} />
          ))}
        </ul>
      </Panel>
      <Panel title={tr("Preview")}>
        <div className="mx-auto max-w-xs rounded-control border border-dashed border-line-strong bg-subtle p-5 font-mono text-xs text-ink">
          {fields.centerName && <p className="mb-1 text-center text-base tracking-widest">{centerName}</p>}
          {fields.receiptNo && <p className="mb-3 text-center text-ink-muted">{sample.receiptNo[1]}</p>}
          <dl className="space-y-1 border-t border-line pt-2">
            {(['time', 'student', 'teacher', 'staff', 'group', 'method', 'note'] as const)
              .filter((f) => fields[f])
              .map((f) => (
                <div key={f} className="flex justify-between gap-3">
                  <dt>{sample[f][0]}:</dt>
                  <dd className="text-right">{sample[f][1]}</dd>
                </div>
              ))}
          </dl>
          {fields.amount && (
            <p className="mt-3 flex justify-between border-t border-line pt-2 font-semibold">
              <span>{tr("Total")}:</span>
              <span>{sample.amount[1]}</span>
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}

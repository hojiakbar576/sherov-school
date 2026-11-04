import { useState, type FormEvent } from 'react'
import { MessageSquare, MessageSquareText, Phone, PhoneIncoming, Send, StickyNote, Trash2, Users } from 'lucide-react'
import type { ContactChannel } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { toISODate } from '../../lib/dates'
import { formatDate, formatRelative } from '../../lib/format'
import { cn } from '../../lib/cn'

const CHANNELS: { value: ContactChannel; label: string; icon: typeof Phone }[] = [
  { value: 'call', label: 'Phone call', icon: Phone },
  { value: 'sms', label: 'SMS', icon: MessageSquareText },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'visit', label: 'Visit in person', icon: Users },
  { value: 'note', label: 'Note', icon: StickyNote },
]
const channelOf = (c: ContactChannel) => CHANNELS.find((x) => x.value === c)!

interface Props {
  subject: { type: 'student' | 'lead'; id: string }
  /** Who staff usually talk to, offered as the first choice. */
  contacts: string[]
  className?: string
}

/**
 * Calls, messages and visits with a student's family or an enquiry, newest
 * first. The app records them; it doesn't send SMS or Telegram messages yet.
 */
export function ContactLogPanel({ subject, contacts, className }: Props) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const userName = new Map(data.users.map((u) => [u.id, u.fullName]))
  const logs = data.contactLogs.filter((l) => l.subject.type === subject.type && l.subject.id === subject.id).sort((a, b) => b.at.localeCompare(a.at))
  const due = logs.filter((l) => l.followUpOn && l.followUpOn <= toISODate(now)).length

  return (
    <Panel
      title="Calls and messages"
      description={due ? `${due} follow-up ${due === 1 ? 'is' : 'are'} due` : 'Logged by staff. SMS and Telegram are recorded here, not sent from the app yet.'}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <MessageSquare aria-hidden />
          Log a call or message
        </Button>
      }
      className={className}
      flush
    >
      {logs.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-sm text-ink-muted">Nothing logged yet. Log calls so anyone can see what was agreed.</p>
      ) : (
        <>
          <ol className="divide-y divide-line border-t border-line">
            {(showAll ? logs : logs.slice(0, 5)).map((l) => {
              const ch = channelOf(l.channel)
              const Icon = l.channel === 'call' && l.direction === 'incoming' ? PhoneIncoming : ch.icon
              return (
                <li key={l.id} className="flex gap-3 px-5 py-3 text-sm">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{l.summary}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {ch.label}
                      {l.direction === 'incoming' ? ' (they contacted us)' : ''}
                      {l.withWhom ? ` with ${l.withWhom}` : ''} · {formatRelative(l.at, now)}
                      {l.byUserId ? ` · ${userName.get(l.byUserId) ?? ''}` : ''}
                    </p>
                    {l.followUpOn && (
                      <p className={cn('mt-0.5 text-xs font-medium', l.followUpOn <= toISODate(now) ? 'text-warning' : 'text-ink-muted')}>Follow up on {formatDate(l.followUpOn)}</p>
                    )}
                  </div>
                  <IconButton
                    label="Delete this entry"
                    onClick={() => {
                      actions.deleteContactLog(l.id)
                      toast.show('Entry deleted.')
                    }}
                    className="size-7 hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              )
            })}
          </ol>
          {logs.length > 5 && (
            <div className="border-t border-line px-5 py-2.5">
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${logs.length}`}
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Log a call or message">
        {open && <LogForm subject={subject} contacts={contacts} onClose={() => setOpen(false)} />}
      </Dialog>
    </Panel>
  )
}

function LogForm({ subject, contacts, onClose }: Props & { onClose: () => void }) {
  const { now, actions } = useSchool()
  const toast = useToast()
  const [channel, setChannel] = useState<ContactChannel>('call')
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [withWhom, setWithWhom] = useState(contacts[0] ?? '')
  const [summary, setSummary] = useState('')
  const [followUpOn, setFollowUpOn] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (summary.trim().length < 3) return setError('Write what was said or agreed.')
    actions.addContactLog({ subject, channel, direction, withWhom: withWhom.trim() || undefined, summary: summary.trim(), followUpOn: followUpOn || undefined })
    toast.show('Logged.')
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="How">
        {(p) => (
          <Select {...p} value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)}>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Who started it">
        {(p) => (
          <Select {...p} value={direction} onChange={(e) => setDirection(e.target.value as 'outgoing' | 'incoming')} disabled={channel === 'note'}>
            <option value="outgoing">We contacted them</option>
            <option value="incoming">They contacted us</option>
          </Select>
        )}
      </Field>
      <Field label="With" optional className="sm:col-span-2">
        {(p) => (
          <>
            <Input {...p} list="contact-people" value={withWhom} maxLength={80} onChange={(e) => setWithWhom(e.target.value)} />
            <datalist id="contact-people">
              {contacts.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="What was said or agreed" error={error || undefined} className="sm:col-span-2">
        {(p) => (
          <Textarea
            {...p}
            autoFocus
            rows={3}
            maxLength={500}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value)
              setError('')
            }}
            placeholder="e.g. Mother will pay on Friday"
          />
        )}
      </Field>
      <Field label="Follow up on" optional hint="Shows as due on this date.">
        {(p) => <Input {...p} type="date" min={toISODate(now)} value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  )
}

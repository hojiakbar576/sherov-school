import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, Minus, PlugZap, Sparkles, X } from 'lucide-react'
import { createId } from '../../../lib/id'
import { cn } from '../../../lib/cn'
import { tr } from '../../../i18n'
import { askSherovIntelligence, INTELLIGENCE_CONNECTED, type ChatMessage } from './intelligence-client'

/** A message in the panel: the owner's, the assistant's, or a notice from the interface itself. */
type Entry = ChatMessage | { id: string; role: 'notice'; text: string }

const SUGGESTIONS = [
  tr("Which advertising source brings the most students?"),
  tr("Why have students been leaving?"),
  tr("Which branch has the highest overdue debt?"),
  tr("How is each teacher’s student retention?"),
  tr("What should I focus on this month?"),
]

/**
 * Sherov Intelligence: the owner's assistant, as a floating button that opens
 * a chat panel. Owner Portal only (mounted by AppLayout for the owner on
 * /owner pages). This is the interface; answers come from
 * intelligence-client.ts, which has no backend yet, so the panel says so
 * plainly and never shows a made-up answer.
 */
export function SherovIntelligence() {
  // closed: only the button. open: the panel. Minimising keeps the conversation; closing clears it.
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [entries, busy])

  const minimise = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  const close = () => {
    setEntries([])
    setDraft('')
    minimise()
  }

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    const mine: ChatMessage = { id: createId('msg'), role: 'owner', text: question, at: new Date().toISOString() }
    const history = [...entries.filter((e): e is ChatMessage => e.role !== 'notice'), mine]
    setEntries((list) => [...list, mine])
    setDraft('')
    setBusy(true)
    const reply = await askSherovIntelligence(history)
    setBusy(false)
    setEntries((list) => [
      ...list,
      reply.ok
        ? { id: createId('msg'), role: 'assistant', text: reply.text, at: new Date().toISOString() }
        : {
            id: createId('msg'),
            role: 'notice',
            text:
              reply.reason === 'not_connected'
                ? tr("Sherov Intelligence isn’t connected yet, so it can’t answer this. Nothing was sent anywhere. Your dashboards show the current figures.")
                : reply.message,
          },
    ])
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(draft)
  }

  return (
    <div className="print:hidden">
      {/* The panel stays mounted so opening and closing can animate and the conversation survives minimising. */}
      <section
        role="dialog"
        aria-label={tr("Sherov Intelligence")}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={(e) => e.key === 'Escape' && minimise()}
        className={cn(
          'fixed right-3 bottom-3 left-3 z-40 flex max-h-[min(40rem,calc(100dvh-1.5rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_-12px_rgb(18_59_41/0.35)] transition duration-200 ease-out sm:right-6 sm:bottom-6 sm:left-auto sm:w-[25.5rem]',
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-95 opacity-0',
        )}
      >
        <header className="flex items-center gap-3 bg-pine px-4 py-3.5 text-white">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/12">
            <Sparkles className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[0.9375rem] leading-tight font-semibold">{tr("Sherov Intelligence")}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/75">
              <span aria-hidden className={cn('size-1.5 rounded-full', INTELLIGENCE_CONNECTED ? 'bg-[#6ee7a0]' : 'bg-white/45')} />
              {INTELLIGENCE_CONNECTED ? tr("Connected") : tr("Not connected yet")}
            </p>
          </div>
          <button type="button" onClick={minimise} aria-label={tr("Minimise")} title={tr("Minimise")} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/12 hover:text-white">
            <Minus aria-hidden className="size-4" />
          </button>
          <button type="button" onClick={close} aria-label={tr("Close and clear the conversation")} title={tr("Close and clear the conversation")} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/12 hover:text-white">
            <X aria-hidden className="size-4" />
          </button>
        </header>

        {!INTELLIGENCE_CONNECTED && (
          <p className="flex items-start gap-2 border-b border-line bg-subtle px-4 py-2.5 text-xs text-ink-muted">
            <PlugZap aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {tr("Preview of the interface. The AI service is not connected yet, so questions aren’t answered.")}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          {entries.length === 0 ? (
            <div>
              <p className="text-[0.9375rem] font-medium text-ink">{tr("Hello, Mr. Sherzod.")}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {tr("I’m being set up to answer questions about students, enquiries, money and branches, using the school’s own records. Questions you’ll be able to ask:")}
              </p>
              <ul className="mt-3 space-y-2">
                {SUGGESTIONS.map((q) => (
                  <li key={q}>
                    <button type="button" onClick={() => void send(q)} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-left text-sm text-ink hover:border-brand-muted hover:bg-brand-soft/50">
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="space-y-3">
              {entries.map((e) =>
                e.role === 'notice' ? (
                  <li key={e.id} className="flex items-start gap-2 rounded-control border border-dashed border-line-strong bg-canvas px-3 py-2.5 text-sm text-ink-muted">
                    <PlugZap aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>{e.text}</span>
                  </li>
                ) : (
                  <li key={e.id} className={cn('flex', e.role === 'owner' ? 'justify-end' : 'justify-start')}>
                    <p className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap', e.role === 'owner' ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-subtle text-ink')}>
                      <span className="sr-only">{e.role === 'owner' ? tr("You:") : tr("Sherov Intelligence:")} </span>
                      {e.text}
                    </p>
                  </li>
                ),
              )}
              {busy && (
                <li className="flex justify-start">
                  <span className="rounded-2xl rounded-bl-md bg-subtle px-3.5 py-2 text-sm text-ink-muted">{tr("Thinking…")}</span>
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="border-t border-line p-3">
          <div className="flex items-end gap-2 rounded-xl border border-line-input bg-surface py-1.5 pr-1.5 pl-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draft)
                }
              }}
              aria-label={tr("Your question")}
              placeholder={tr("Ask about your school…")}
              maxLength={1000}
              className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button type="submit" disabled={!draft.trim() || busy} aria-label={tr("Send")} title={tr("Send")} className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-hover disabled:bg-subtle disabled:text-ink-faint">
              <ArrowUp aria-hidden className="size-4" />
            </button>
          </div>
        </form>
      </section>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tr("Open Sherov Intelligence")}
        aria-expanded={open}
        title={tr("Sherov Intelligence")}
        className={cn(
          'fixed right-4 bottom-4 z-30 flex h-14 items-center gap-2.5 rounded-full bg-pine pr-5 pl-4 text-white shadow-[0_10px_30px_-8px_rgb(18_59_41/0.55)] transition duration-200 hover:-translate-y-0.5 hover:bg-brand-ink sm:right-6 sm:bottom-6',
          open && 'pointer-events-none scale-90 opacity-0',
        )}
      >
        <span className="relative flex size-7 items-center justify-center">
          <Sparkles aria-hidden className="size-5" />
          {entries.length > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-pine bg-accent" />}
        </span>
        <span className="text-sm font-semibold">{tr("Ask AI")}</span>
      </button>
    </div>
  )
}

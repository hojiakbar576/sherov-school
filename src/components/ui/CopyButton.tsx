import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../../lib/cn'

/** Small button that copies a value (e.g. a phone number) and confirms with a tick. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (e.g. insecure context): select-and-copy still works on the text itself.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-subtle hover:text-ink',
        copied && 'text-success hover:text-success',
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/** A phone number you can tap to call, with a copy button beside it. */
export function PhoneLine({ phone, className }: { phone: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="num whitespace-nowrap hover:text-brand hover:underline">
        {phone}
      </a>
      <CopyButton value={phone} label={`Copy ${phone}`} />
    </span>
  )
}

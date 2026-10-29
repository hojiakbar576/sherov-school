import { cn } from '../../lib/cn'

/**
 * The Sherov School mark: an open book seen head-on, its two pages rising
 * from a shared spine, with a point of light above it.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#4F46E5" />
      <path d="M6 10.5 15 13v11l-9-2.5z" fill="#fff" />
      <path d="M26 10.5 17 13v11l9-2.5z" fill="#fff" fillOpacity=".72" />
      <circle cx="16" cy="7.5" r="2" fill="#fff" />
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">Sherov School</span>
          <span className="text-xs text-ink-muted">Learning Center</span>
        </span>
      )}
    </span>
  )
}

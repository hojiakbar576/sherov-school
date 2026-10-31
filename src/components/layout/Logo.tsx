import { cn } from '../../lib/cn'

/**
 * One ring of the Sherov School mark. Four copies, each turned a quarter,
 * interlock in a pinwheel; the gap is where the next ring passes over.
 */
const RING = 'M19.57 13A4.6 4.6 0 1 1 20.6 10.18'

/**
 * The Sherov School mark: four interlinked open rings. On dark surfaces it
 * sits on the ivory disc, as on the school's own profile picture.
 */
export function LogoMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      {onDark && <circle cx="16" cy="16" r="16" fill="var(--color-ivory)" />}
      <g
        fill="none"
        stroke="var(--color-logo)"
        strokeWidth="2"
        transform={onDark ? 'translate(16 16) scale(.8) translate(-16 -16)' : undefined}
      >
        {[0, 90, 180, 270].map((angle) => (
          <path key={angle} d={RING} transform={`rotate(${angle} 16 16)`} />
        ))}
      </g>
    </svg>
  )
}

/** Mark plus the stacked "SHEROV / SCHOOL" wordmark. */
export function Logo({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark onDark={onDark} className="size-9" />
      {compact ? (
        <span className="sr-only">Sherov School</span>
      ) : (
        <span
          className={cn(
            'flex flex-col text-[0.8125rem] leading-[1.1] font-semibold tracking-[0.06em] uppercase',
            onDark ? 'text-sidebar-ink' : 'text-logo',
          )}
        >
          <span>Sherov</span>
          <span>School</span>
        </span>
      )}
    </span>
  )
}

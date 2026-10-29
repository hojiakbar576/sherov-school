import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface PanelProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Remove body padding, e.g. for edge-to-edge tables. */
  flush?: boolean
  id?: string
}

/** A titled section of a page. Borders only, no drop shadow. */
export function Panel({ title, description, actions, children, className, flush, id }: PanelProps) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={cn('flex min-w-0 flex-col rounded-panel border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[0.9375rem] font-semibold text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', !flush && 'px-5 pb-5')}>{children}</div>
    </section>
  )
}

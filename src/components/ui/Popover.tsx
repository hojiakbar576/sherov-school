import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface PopoverProps {
  /** Renders the trigger button; spread `props` onto it. */
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-controls': string; 'aria-haspopup': 'dialog' }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  className?: string
  label: string
}

/**
 * A small panel that opens under a button (notifications, profile).
 * Closes on Escape (returning focus to the trigger) and on outside click.
 */
export function Popover({ trigger, children, align = 'end', className, label }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector<HTMLElement>('[aria-controls]')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative">
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': 'dialog' })}
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          onBlur={(event) => {
            // Close when keyboard focus leaves the panel and its trigger.
            if (event.relatedTarget && !rootRef.current?.contains(event.relatedTarget as Node)) close()
          }}
          className={cn(
            'absolute top-full z-40 mt-2 rounded-panel border border-line bg-surface shadow-pop focus:outline-none',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

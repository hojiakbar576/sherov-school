import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button, IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

/**
 * Modal built on the native <dialog> element: the browser handles focus
 * trapping, Escape to close, and making the rest of the page inert.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-panel border border-line bg-surface p-0 text-ink shadow-pop',
        'max-h-[calc(100dvh-2rem)] overflow-hidden',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-sm text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
              <X />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** Asks before anything destructive. The confirm button names the action. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-ink-muted">{children}</div>
    </Dialog>
  )
}

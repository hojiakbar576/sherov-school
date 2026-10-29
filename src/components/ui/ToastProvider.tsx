import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ToastContext, type ToastApi, type ToastTone } from './toast-context'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

const icons = { success: CircleCheck, error: CircleAlert, info: Info }
const iconColors = { success: 'text-success', error: 'text-danger', info: 'text-accent' }

let nextId = 1

/** Short confirmations ("Payment recorded") shown bottom-right, announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const api = useMemo<ToastApi>(
    () => ({
      show(message, tone = 'success') {
        const id = nextId++
        setToasts((list) => [...list.slice(-2), { id, message, tone }])
        window.setTimeout(() => dismiss(id), 4500)
      },
    }),
    [dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.tone]
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-panel border border-line bg-surface px-4 py-3 text-sm shadow-pop"
            >
              <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconColors[toast.tone])} />
              <p className="flex-1 text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-m-1 rounded p-1 text-ink-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

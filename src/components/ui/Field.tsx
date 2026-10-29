import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface FieldProps {
  label: string
  /** Shown under the control; replaced by the error when there is one. */
  hint?: ReactNode
  error?: string
  optional?: boolean
  className?: string
  /** Receives the ids the control needs for an accessible label and description. */
  children: (control: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}

/** Label + control + hint/error, wired together for screen readers. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-muted">Optional</span>}
      </label>
      {children({ id, 'aria-describedby': message ? messageId : undefined, 'aria-invalid': error ? true : undefined })}
      {message && (
        <p id={messageId} className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-ink-muted')}>
          {message}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('field-control', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('field-control appearance-none bg-[url(/chevron.svg)] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('field-control min-h-20 resize-y', className)} {...props} />
}

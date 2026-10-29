import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '../../lib/cn'
import { buttonClasses, type Size, type Variant } from './button-styles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className as string | undefined)} {...props} />
}

/** Square button with only an icon. `label` is required for screen readers. */
export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-subtle hover:text-ink [&_svg]:size-[18px]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

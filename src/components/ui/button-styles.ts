import { cn } from '../../lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-subtle',
  ghost: 'text-ink-muted hover:bg-subtle hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-hover',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

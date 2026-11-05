export type Tone = 'neutral' | 'brand' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

/** The small coloured dot for each tone, also used for admissions stage colours. */
export const toneDot: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  brand: 'bg-brand',
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning-mark',
  danger: 'bg-danger',
}

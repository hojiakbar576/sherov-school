// Small shared bits for the owner pages.

/** One steady colour per branch, in branch order, for charts and keys. */
export const BRANCH_COLORS = ['var(--color-cat-green)', 'var(--color-cat-blue)', 'var(--color-cat-orange)', 'var(--color-cat-plum)']

/** "+12%" / "−5%" for a change ratio; empty without a base. */
export function formatChange(ratio: number | null): string {
  if (ratio === null) return ''
  const pct = Math.round(ratio * 100)
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`
}

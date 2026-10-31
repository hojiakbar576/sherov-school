// Shared chart styling so every chart in the app reads as one system.
// Values point at the design tokens in index.css; nothing is defined here.

export const CHART_COLORS = {
  present: 'var(--color-brand)',
  late: 'var(--color-warning-mark)',
  absent: 'var(--color-danger-mark)',
  revenue: 'var(--color-brand)',
  revenueMuted: 'var(--color-brand-muted)',
  enrolment: 'var(--color-chart-2)',
  grid: 'var(--color-chart-grid)',
  axis: 'var(--color-ink-muted)',
}

export const axisProps = {
  tick: { fill: CHART_COLORS.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid var(--color-line)',
    boxShadow: 'var(--shadow-pop)',
    fontSize: 13,
    padding: '8px 12px',
  },
  labelStyle: { color: 'var(--color-ink)', fontWeight: 600, marginBottom: 4 },
  cursor: { fill: 'var(--color-subtle)' },
} as const

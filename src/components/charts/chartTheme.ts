// Shared chart styling so every chart in the app reads as one system.

export const CHART_COLORS = {
  present: '#4F46E5',
  late: '#E0A12B',
  absent: '#D9645A',
  revenue: '#4F46E5',
  revenueMuted: '#C7CBF8',
  enrolment: '#2F7A55',
  grid: '#EEF0F3',
  axis: '#5F6B7E',
}

export const axisProps = {
  tick: { fill: CHART_COLORS.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #E5E7EB',
    boxShadow: '0 8px 24px -6px rgb(23 32 51 / 0.14)',
    fontSize: 13,
    padding: '8px 12px',
  },
  labelStyle: { color: '#172033', fontWeight: 600, marginBottom: 4 },
  cursor: { fill: '#F1F3F6' },
} as const

import { useMemo } from 'react'
import { useSchool } from '../data/school-context'
import { attentionItems, type AttentionItem, type AttentionKind } from '../lib/metrics'

export const attentionLabel: Record<AttentionKind, string> = {
  overdue: 'Tuition overdue',
  absences: 'Repeated absences',
  capacity: 'Group almost full',
  attendance_missing: 'Attendance missing',
}

/** Where to go to resolve an item. */
export function attentionLink(item: AttentionItem): string {
  switch (item.kind) {
    case 'overdue':
    case 'absences':
      return `/students/${item.studentId}`
    case 'capacity':
      return `/groups?q=${encodeURIComponent(item.title)}`
    case 'attendance_missing':
      return `/attendance?group=${item.groupId}&date=${item.date}`
  }
}

/** Everything that currently needs the administrator's attention. */
export function useAttention(): AttentionItem[] {
  const { data, now, balances } = useSchool()
  return useMemo(() => attentionItems(data, now, balances), [data, now, balances])
}

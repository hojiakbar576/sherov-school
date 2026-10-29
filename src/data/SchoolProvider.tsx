import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Activity, ActivityType, SchoolData } from '../types'
import { createId } from '../lib/id'
import { formatUZS } from '../lib/format'
import { computeBalances } from '../lib/metrics'
import { useNow } from '../hooks/useNow'
import { createDemoData } from './seed'
import { loadData, saveData, STORAGE_KEY, validateSchoolData } from './storage'
import { SchoolContext, type SchoolActions, type SchoolContextValue } from './school-context'

const MAX_ACTIVITY = 100

function activity(type: ActivityType, title: string, detail: string): Activity {
  return { id: createId('act'), type, title, detail, at: new Date().toISOString() }
}

function withActivity(data: SchoolData, entry: Activity): SchoolData {
  return { ...data, activity: [entry, ...data.activity].slice(0, MAX_ACTIVITY) }
}

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadData())
  const [data, setData] = useState<SchoolData>(initial.data)
  const [persistent, setPersistent] = useState(initial.persistent)
  const [loadProblem, setLoadProblem] = useState<string | null>(initial.problem ?? null)
  const now = useNow()

  // Save every change to localStorage (the "external system" this effect syncs with).
  // State is only touched when a write fails, e.g. storage is full.
  useEffect(() => {
    if (!initial.persistent || saveData(data)) return
    setPersistent(false)
    setLoadProblem('Changes could not be saved in this browser. They will be lost when you refresh.')
  }, [data, initial.persistent])

  // Keep two open tabs in step with each other.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const next: unknown = JSON.parse(event.newValue)
        if (validateSchoolData(next) === null) setData(next as SchoolData)
      } catch {
        // Ignore unreadable updates from other tabs.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((change: (prev: SchoolData) => SchoolData) => setData(change), [])

  const actions = useMemo<SchoolActions>(() => {
    const groupName = (d: SchoolData, id: string | null) => d.groups.find((g) => g.id === id)?.name

    return {
      addStudent(input) {
        const student = { ...input, id: createId('stu') }
        update((d) =>
          withActivity(
            { ...d, students: [...d.students, student] },
            activity('student_added', 'Student registered', `${student.fullName} joined ${groupName(d, student.groupId) ?? 'the centre (no group yet)'}`),
          ),
        )
        return student
      },
      updateStudent(id, input) {
        update((d) => {
          const before = d.students.find((s) => s.id === id)
          const moved = before && before.groupId !== input.groupId && input.groupId
          const entry = moved
            ? activity('group_changed', 'Student added to a group', `${input.fullName} moved to ${groupName(d, input.groupId) ?? 'a group'}`)
            : activity('student_updated', 'Student details updated', input.fullName)
          return withActivity({ ...d, students: d.students.map((s) => (s.id === id ? { ...input, id } : s)) }, entry)
        })
      },
      deleteStudent(id) {
        update((d) => {
          const student = d.students.find((s) => s.id === id)
          const attendance = d.attendance.map((r) => {
            if (!(id in r.marks)) return r
            const marks = { ...r.marks }
            delete marks[id]
            return { ...r, marks }
          })
          return withActivity(
            {
              ...d,
              students: d.students.filter((s) => s.id !== id),
              payments: d.payments.filter((p) => p.studentId !== id),
              attendance,
            },
            activity('student_removed', 'Student record deleted', student?.fullName ?? 'A student'),
          )
        })
      },

      addTeacher(input) {
        const teacher = { ...input, id: createId('tch') }
        update((d) =>
          withActivity({ ...d, teachers: [...d.teachers, teacher] }, activity('teacher_changed', 'Teacher added', `${teacher.fullName}, ${teacher.subject}`)),
        )
        return teacher
      },
      updateTeacher(id, input) {
        update((d) =>
          withActivity(
            { ...d, teachers: d.teachers.map((t) => (t.id === id ? { ...input, id } : t)) },
            activity('teacher_changed', 'Teacher details updated', input.fullName),
          ),
        )
      },
      deleteTeacher(id) {
        if (data.groups.some((g) => g.teacherId === id)) return false
        update((d) => {
          const teacher = d.teachers.find((t) => t.id === id)
          return withActivity(
            { ...d, teachers: d.teachers.filter((t) => t.id !== id) },
            activity('teacher_changed', 'Teacher removed', teacher?.fullName ?? 'A teacher'),
          )
        })
        return true
      },

      addGroup(input) {
        const group = { ...input, id: createId('grp') }
        update((d) =>
          withActivity({ ...d, groups: [...d.groups, group] }, activity('group_changed', 'Group created', `${group.name}, ${group.room}, ${group.startTime}`)),
        )
        return group
      },
      updateGroup(id, input) {
        update((d) =>
          withActivity(
            { ...d, groups: d.groups.map((g) => (g.id === id ? { ...input, id } : g)) },
            activity('group_changed', 'Group updated', input.name),
          ),
        )
      },
      deleteGroup(id) {
        update((d) => {
          const name = groupName(d, id) ?? 'A group'
          return withActivity(
            {
              ...d,
              groups: d.groups.filter((g) => g.id !== id),
              students: d.students.map((s) => (s.groupId === id ? { ...s, groupId: null } : s)),
              attendance: d.attendance.filter((r) => r.groupId !== id),
            },
            activity('group_changed', 'Group deleted', `${name}. Its students are now unassigned`),
          )
        })
      },

      saveAttendance(groupId, date, marks) {
        update((d) => {
          const existing = d.attendance.find((r) => r.groupId === groupId && r.date === date)
          const record = { id: existing?.id ?? createId('att'), groupId, date, marks, savedAt: new Date().toISOString() }
          const values = Object.values(marks)
          const attended = values.filter((m) => m !== 'absent').length
          return withActivity(
            {
              ...d,
              attendance: existing ? d.attendance.map((r) => (r.id === existing.id ? record : r)) : [...d.attendance, record],
            },
            activity(
              'attendance_saved',
              existing ? 'Attendance updated' : 'Attendance submitted',
              `${groupName(d, groupId) ?? 'A group'}: ${attended} of ${values.length} present`,
            ),
          )
        })
      },

      addPayment(input) {
        const payment = { ...input, id: createId('pay') }
        update((d) => {
          const student = d.students.find((s) => s.id === payment.studentId)
          return withActivity(
            { ...d, payments: [...d.payments, payment] },
            activity('payment_recorded', 'Tuition payment recorded', `${student?.fullName ?? 'A student'} paid ${formatUZS(payment.amount)}`),
          )
        })
        return payment
      },
      updatePayment(id, input) {
        update((d) => {
          const student = d.students.find((s) => s.id === input.studentId)
          return withActivity(
            { ...d, payments: d.payments.map((p) => (p.id === id ? { ...input, id } : p)) },
            activity('payment_recorded', 'Payment updated', `${student?.fullName ?? 'A student'}: ${formatUZS(input.amount)}`),
          )
        })
      },
      deletePayment(id) {
        update((d) => {
          const payment = d.payments.find((p) => p.id === id)
          const student = d.students.find((s) => s.id === payment?.studentId)
          return withActivity(
            { ...d, payments: d.payments.filter((p) => p.id !== id) },
            activity('payment_recorded', 'Payment deleted', `${student?.fullName ?? 'A student'}: ${formatUZS(payment?.amount ?? 0)}`),
          )
        })
      },

      updateSettings(settings) {
        update((d) => withActivity({ ...d, settings }, activity('settings_changed', 'Centre settings updated', settings.centerName)))
      },
      markNotificationsRead(ids) {
        update((d) => ({ ...d, readNotificationIds: Array.from(new Set([...d.readNotificationIds, ...ids])).slice(-500) }))
      },
      resetDemoData() {
        setData(createDemoData(new Date()))
        setLoadProblem(null)
      },
    }
  }, [update, data.groups])

  const balances = useMemo(() => computeBalances(data, now), [data, now])

  const value = useMemo<SchoolContextValue>(
    () => ({
      data,
      now,
      balances,
      persistent,
      loadProblem,
      dismissLoadProblem: () => setLoadProblem(null),
      actions,
    }),
    [data, now, balances, persistent, loadProblem, actions],
  )

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Activity, ActivityType, Notification, SchoolData, User } from '../types'
import { createId } from '../lib/id'
import { dayPatternLabel, formatUZS } from '../lib/format'
import { computeBalances } from '../lib/metrics'
import { demoSignIn, readSession, SESSION_KEY, SIGN_IN_ROLES, writeSession } from '../lib/auth'
import { canTeachGroup, scopeData, userBranchId } from '../lib/scope'
import { useNow } from '../hooks/useNow'
import { createDemoData } from './seed'
import { DEFAULT_BRANCH_ID, teacherUser } from './seed-portal'
import { loadData, saveData, STORAGE_KEY, validateSchoolData } from './storage'
import { SchoolContext, type SchoolActions, type SchoolContextValue } from './school-context'

const MAX_ACTIVITY = 100

function activity(type: ActivityType, title: string, detail: string, branchId?: string): Activity {
  return { id: createId('act'), type, title, detail, at: new Date().toISOString(), branchId }
}

function withActivity(data: SchoolData, entry: Activity): SchoolData {
  return { ...data, activity: [entry, ...data.activity].slice(0, MAX_ACTIVITY) }
}

function notice(n: Omit<Notification, 'id' | 'createdAt'>): Notification {
  return { ...n, id: createId('ntf'), createdAt: new Date().toISOString() }
}

/** Only accounts whose role can sign in today count as a session. */
function sessionUser(data: SchoolData, userId: string | null): User | null {
  return data.users.find((u) => u.id === userId && SIGN_IN_ROLES.includes(u.role)) ?? null
}

class NotPermittedError extends Error {}

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadData())
  const [fullData, setData] = useState<SchoolData>(initial.data)
  const [persistent, setPersistent] = useState(initial.persistent)
  const [loadProblem, setLoadProblem] = useState<string | null>(initial.problem ?? null)
  const [userId, setUserId] = useState<string | null>(() => readSession())
  const now = useNow()

  const user = sessionUser(fullData, userId)
  const data = useMemo(() => (user ? scopeData(fullData, user) : fullData), [fullData, user])

  // Save every change to localStorage (the "external system" this effect syncs with).
  // State is only touched when a write fails, e.g. storage is full.
  useEffect(() => {
    if (!initial.persistent || saveData(fullData)) return
    setPersistent(false)
    setLoadProblem('Changes could not be saved in this browser. They will be lost when you refresh.')
  }, [fullData, initial.persistent])

  // Keep two open tabs in step with each other, including signing in and out.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) {
        setUserId(event.newValue)
        return
      }
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

  const signIn = useCallback(
    (username: string, password: string) => {
      const found = demoSignIn(fullData.users, username, password)
      if (found) {
        writeSession(found.id)
        setUserId(found.id)
      }
      return found
    },
    [fullData.users],
  )

  const signOut = useCallback(() => {
    writeSession(null)
    setUserId(null)
  }, [])

  const actions = useMemo<SchoolActions>(() => {
    const groupName = (d: SchoolData, id: string | null) => d.groups.find((g) => g.id === id)?.name
    const actorBranch = user ? userBranchId(fullData, user) : null

    // Administrators (and later the owner) manage records; teachers can't.
    // The UI never offers these to teachers, so a call is a programming error.
    const requireManager = () => {
      if (!user || user.role === 'teacher') throw new NotPermittedError('Only administrators can change this.')
    }
    // An administrator may only change records in their own branch.
    const requireInBranch = (branchId: string | undefined) => {
      requireManager()
      if (user?.role === 'admin' && branchId !== user.branchId) {
        throw new NotPermittedError('This record belongs to another branch.')
      }
    }
    const branchForGroup = (groupId: string | null) =>
      fullData.groups.find((g) => g.id === groupId)?.branchId ?? actorBranch ?? DEFAULT_BRANCH_ID
    const teachableGroup = (groupId: string) => {
      const group = fullData.groups.find((g) => g.id === groupId)
      return user && canTeachGroup(user, group, fullData) ? group : undefined
    }

    return {
      addStudent(input) {
        requireManager()
        const student = { ...input, id: createId('stu'), branchId: branchForGroup(input.groupId) }
        requireInBranch(student.branchId)
        update((d) =>
          withActivity(
            { ...d, students: [...d.students, student] },
            activity('student_added', 'Student registered', `${student.fullName} joined ${groupName(d, student.groupId) ?? 'the centre (no group yet)'}`, student.branchId),
          ),
        )
        return student
      },
      updateStudent(id, input) {
        const before = fullData.students.find((s) => s.id === id)
        requireInBranch(before?.branchId)
        const branchId = input.groupId ? branchForGroup(input.groupId) : before!.branchId
        requireInBranch(branchId)
        update((d) => {
          const moved = before && before.groupId !== input.groupId && input.groupId
          const entry = moved
            ? activity('group_changed', 'Student added to a group', `${input.fullName} moved to ${groupName(d, input.groupId) ?? 'a group'}`, branchId)
            : activity('student_updated', 'Student details updated', input.fullName, branchId)
          return withActivity({ ...d, students: d.students.map((s) => (s.id === id ? { ...input, id, branchId } : s)) }, entry)
        })
      },
      deleteStudent(id) {
        const student = fullData.students.find((s) => s.id === id)
        requireInBranch(student?.branchId)
        update((d) => {
          const attendance = d.attendance.map((r) => {
            if (!(id in r.marks)) return r
            const marks = { ...r.marks }
            delete marks[id]
            const comments = r.comments && { ...r.comments }
            if (comments) delete comments[id]
            return { ...r, marks, comments }
          })
          return withActivity(
            {
              ...d,
              students: d.students.filter((s) => s.id !== id),
              payments: d.payments.filter((p) => p.studentId !== id),
              attendance,
            },
            activity('student_removed', 'Student record deleted', student?.fullName ?? 'A student', student?.branchId),
          )
        })
      },

      addTeacher(input) {
        requireManager()
        // New teachers join the administrator's branch. Moving branches is for the owner.
        const teacher = { ...input, id: createId('tch'), branchId: actorBranch ?? DEFAULT_BRANCH_ID }
        update((d) =>
          withActivity(
            { ...d, teachers: [...d.teachers, teacher], users: [...d.users, teacherUser(teacher, d.users)] },
            activity('teacher_changed', 'Teacher added', `${teacher.fullName}, ${teacher.subject}`, teacher.branchId),
          ),
        )
        return teacher
      },
      updateTeacher(id, input) {
        const before = fullData.teachers.find((t) => t.id === id)
        requireInBranch(before?.branchId)
        update((d) =>
          withActivity(
            {
              ...d,
              teachers: d.teachers.map((t) => (t.id === id ? { ...input, id, branchId: t.branchId } : t)),
              users: d.users.map((u) => (u.teacherId === id ? { ...u, fullName: input.fullName } : u)),
            },
            activity('teacher_changed', 'Teacher details updated', input.fullName, before?.branchId),
          ),
        )
      },
      deleteTeacher(id) {
        const teacher = fullData.teachers.find((t) => t.id === id)
        requireInBranch(teacher?.branchId)
        if (fullData.groups.some((g) => g.teacherId === id)) return false
        update((d) =>
          withActivity(
            { ...d, teachers: d.teachers.filter((t) => t.id !== id), users: d.users.filter((u) => u.teacherId !== id) },
            activity('teacher_changed', 'Teacher removed', teacher?.fullName ?? 'A teacher', teacher?.branchId),
          ),
        )
        return true
      },

      addGroup(input) {
        const branchId = fullData.teachers.find((t) => t.id === input.teacherId)?.branchId ?? actorBranch ?? DEFAULT_BRANCH_ID
        requireInBranch(branchId)
        const group = { ...input, id: createId('grp'), branchId }
        update((d) =>
          withActivity(
            {
              ...d,
              groups: [...d.groups, group],
              notifications: [
                ...d.notifications,
                notice({
                  kind: 'admin',
                  title: `New group: ${group.name}`,
                  body: `You teach ${group.name} on ${dayPatternLabel[group.days]} at ${group.startTime} in ${group.room}.`,
                  audience: { teacherId: group.teacherId },
                  link: '/teacher/groups',
                }),
              ],
            },
            activity('group_changed', 'Group created', `${group.name}, ${group.room}, ${group.startTime}`, branchId),
          ),
        )
        return group
      },
      updateGroup(id, input) {
        const before = fullData.groups.find((g) => g.id === id)
        requireInBranch(before?.branchId)
        const branchId = fullData.teachers.find((t) => t.id === input.teacherId)?.branchId ?? before!.branchId
        requireInBranch(branchId)
        // Tell the teacher when their timetable changes.
        const messages: Notification[] = []
        if (before && before.teacherId !== input.teacherId) {
          messages.push(
            notice({
              kind: 'admin',
              title: `New group: ${input.name}`,
              body: `You now teach ${input.name} on ${dayPatternLabel[input.days]} at ${input.startTime} in ${input.room}.`,
              audience: { teacherId: input.teacherId },
              link: '/teacher/groups',
            }),
          )
        } else if (before && (before.startTime !== input.startTime || before.room !== input.room || before.days !== input.days)) {
          messages.push(
            notice({
              kind: 'schedule',
              title: `Schedule change: ${input.name}`,
              body: `Was ${dayPatternLabel[before.days]} at ${before.startTime} in ${before.room}. Now ${dayPatternLabel[input.days]} at ${input.startTime} in ${input.room}.`,
              audience: { teacherId: input.teacherId },
              link: '/teacher/schedule',
            }),
          )
        }
        update((d) =>
          withActivity(
            {
              ...d,
              groups: d.groups.map((g) => (g.id === id ? { ...input, id, branchId } : g)),
              notifications: [...d.notifications, ...messages],
            },
            activity('group_changed', 'Group updated', input.name, branchId),
          ),
        )
      },
      deleteGroup(id) {
        const group = fullData.groups.find((g) => g.id === id)
        requireInBranch(group?.branchId)
        update((d) => {
          const name = groupName(d, id) ?? 'A group'
          return withActivity(
            {
              ...d,
              groups: d.groups.filter((g) => g.id !== id),
              students: d.students.map((s) => (s.groupId === id ? { ...s, groupId: null } : s)),
              attendance: d.attendance.filter((r) => r.groupId !== id),
              homework: d.homework.filter((h) => h.groupId !== id),
            },
            activity('group_changed', 'Group deleted', `${name}. Its students are now unassigned`, group?.branchId),
          )
        })
      },

      saveAttendance(groupId, date, marks, comments) {
        const group = teachableGroup(groupId)
        if (!group || !user) return false
        const existing = fullData.attendance.find((r) => r.groupId === groupId && r.date === date)
        // Only students who belong to this class can be marked.
        const allowed = new Set([
          ...fullData.students.filter((s) => s.groupId === groupId).map((s) => s.id),
          ...Object.keys(existing?.marks ?? {}),
        ])
        const cleanMarks = Object.fromEntries(Object.entries(marks).filter(([id]) => allowed.has(id)))
        const cleanComments = Object.fromEntries(
          Object.entries(comments ?? {})
            .map(([id, text]) => [id, text.trim().slice(0, 200)] as const)
            .filter(([id, text]) => allowed.has(id) && text !== ''),
        )
        const record = {
          id: existing?.id ?? createId('att'),
          groupId,
          date,
          // Keep the time and teacher the class actually had, if already recorded.
          startTime: existing?.startTime ?? group.startTime,
          teacherId: existing?.teacherId ?? group.teacherId,
          marks: cleanMarks,
          ...(Object.keys(cleanComments).length > 0 ? { comments: cleanComments } : {}),
          savedAt: new Date().toISOString(),
          recordedBy: user.id,
        }
        const values = Object.values(cleanMarks)
        const attended = values.filter((m) => m !== 'absent').length
        update((d) =>
          withActivity(
            {
              ...d,
              attendance: existing ? d.attendance.map((r) => (r.id === existing.id ? record : r)) : [...d.attendance, record],
            },
            activity(
              'attendance_saved',
              existing ? 'Attendance updated' : 'Attendance submitted',
              `${group.name}: ${attended} of ${values.length} present${user.role === 'teacher' ? ` (by ${user.fullName})` : ''}`,
              group.branchId,
            ),
          ),
        )
        return true
      },

      addHomework(input) {
        const group = teachableGroup(input.groupId)
        if (!group) return null
        const homework = { ...input, id: createId('hw'), teacherId: group.teacherId, createdAt: new Date().toISOString() }
        update((d) =>
          withActivity(
            { ...d, homework: [...d.homework, homework] },
            activity('homework_changed', 'Homework set', `${group.name}: ${homework.title}`, group.branchId),
          ),
        )
        return homework
      },
      updateHomework(id, input) {
        const before = fullData.homework.find((h) => h.id === id)
        // Both the current group and the new one must be the teacher's.
        const group = before && teachableGroup(before.groupId) && teachableGroup(input.groupId)
        if (!before || !group) return false
        update((d) =>
          withActivity(
            { ...d, homework: d.homework.map((h) => (h.id === id ? { ...h, ...input, teacherId: group.teacherId, updatedAt: new Date().toISOString() } : h)) },
            activity('homework_changed', 'Homework updated', `${group.name}: ${input.title}`, group.branchId),
          ),
        )
        return true
      },
      deleteHomework(id) {
        const before = fullData.homework.find((h) => h.id === id)
        const group = before && teachableGroup(before.groupId)
        if (!before || !group) return false
        update((d) =>
          withActivity(
            { ...d, homework: d.homework.filter((h) => h.id !== id) },
            activity('homework_changed', 'Homework removed', `${group.name}: ${before.title}`, group.branchId),
          ),
        )
        return true
      },

      addPayment(input) {
        const student = fullData.students.find((s) => s.id === input.studentId)
        requireInBranch(student?.branchId)
        const payment = { ...input, id: createId('pay') }
        update((d) =>
          withActivity(
            { ...d, payments: [...d.payments, payment] },
            activity('payment_recorded', 'Tuition payment recorded', `${student?.fullName ?? 'A student'} paid ${formatUZS(payment.amount)}`, student?.branchId),
          ),
        )
        return payment
      },
      updatePayment(id, input) {
        const before = fullData.payments.find((p) => p.id === id)
        const student = fullData.students.find((s) => s.id === input.studentId)
        requireInBranch(fullData.students.find((s) => s.id === before?.studentId)?.branchId)
        requireInBranch(student?.branchId)
        update((d) =>
          withActivity(
            { ...d, payments: d.payments.map((p) => (p.id === id ? { ...input, id } : p)) },
            activity('payment_recorded', 'Payment updated', `${student?.fullName ?? 'A student'}: ${formatUZS(input.amount)}`, student?.branchId),
          ),
        )
      },
      deletePayment(id) {
        const payment = fullData.payments.find((p) => p.id === id)
        const student = fullData.students.find((s) => s.id === payment?.studentId)
        requireInBranch(student?.branchId)
        update((d) =>
          withActivity(
            { ...d, payments: d.payments.filter((p) => p.id !== id) },
            activity('payment_recorded', 'Payment deleted', `${student?.fullName ?? 'A student'}: ${formatUZS(payment?.amount ?? 0)}`, student?.branchId),
          ),
        )
      },

      updateSettings(settings) {
        requireManager()
        update((d) => withActivity({ ...d, settings }, activity('settings_changed', 'Centre settings updated', settings.centerName)))
      },
      markNotificationsRead(ids) {
        if (!user) return
        update((d) => {
          const read = d.notificationReads[user.id] ?? []
          return {
            ...d,
            notificationReads: { ...d.notificationReads, [user.id]: Array.from(new Set([...read, ...ids])).slice(-500) },
          }
        })
      },
      resetDemoData() {
        requireManager()
        setData(createDemoData(new Date()))
        setLoadProblem(null)
      },
    }
  }, [update, fullData, user])

  const balances = useMemo(() => computeBalances(data, now), [data, now])
  const branch = useMemo(() => {
    const id = user ? userBranchId(fullData, user) : null
    return fullData.branches.find((b) => b.id === id) ?? null
  }, [fullData, user])
  const demoAccounts = useMemo(() => fullData.users.filter((u) => SIGN_IN_ROLES.includes(u.role)), [fullData.users])

  const value = useMemo<SchoolContextValue>(
    () => ({
      data,
      now,
      balances,
      persistent,
      loadProblem,
      dismissLoadProblem: () => setLoadProblem(null),
      actions,
      user,
      branch,
      demoAccounts,
      signIn,
      signOut,
    }),
    [data, now, balances, persistent, loadProblem, actions, user, branch, demoAccounts, signIn, signOut],
  )

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

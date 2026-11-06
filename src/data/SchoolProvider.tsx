import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BRANCH_STAFF_ROLES } from '../types'
import { checkCourse, levelOf, withGroupLabels } from '../lib/courses'
import type { Activity, ActivityType, Assessment, Bonus, ContactLog, Course, Expense, ExtraLesson, Group, HomeworkResult, Lead, ListItem, Notification, Payment, Room, SalaryPayment, SchoolData, StaffAttendance, Student, StudentNote, User } from '../types'
import { withReceipts } from './seed-office'
import { deleteStage, isSystemStage, stageName, stageNameProblem, SYSTEM_STAGE_NAME, withStageAdded, withStageMoved } from '../lib/lead-stages'
import { tr } from '../i18n'

import { branchData } from '../lib/owner'
import { applyStudentChange, isArchived } from '../lib/student-lifecycle'
import { createId } from '../lib/id'
import { dayPatternLabel, formatUZS } from '../lib/format'
import { computeBalances } from '../lib/metrics'
import { signsInOnOwnerPage, userFromProfile } from '../lib/auth'
import { fetchMyProfile, loginEmail, supabase, type Profile } from '../lib/supabase'
import { canTeachGroup, scopeData, userBranchId } from '../lib/scope'
import { addMonths, monthKey, parseISODate, toISODate } from '../lib/dates'
import { salaryHistory } from '../lib/salary'
import { teacherRatings } from '../lib/rating'
import { useNow } from '../hooks/useNow'
import { createDemoData } from './seed'
import { DEFAULT_BRANCH_ID, teacherUser } from './seed-portal'
import { homeworkStudents } from './seed-learning'
import { loadData, saveData, STORAGE_KEY, validateSchoolData } from './storage'
import { SchoolContext, type OwnerView, type SchoolActions, type SchoolContextValue, type SignInResult, type TeacherView } from './school-context'

const OWNER_BRANCH_KEY = 'sherov-school:owner-branch'
function readOwnerBranch(): string | null {
  try {
    return window.sessionStorage.getItem(OWNER_BRANCH_KEY)
  } catch {
    return null
  }
}

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

/** Signed-in state: still checking, signed out, or signed in with this account. */
type Auth = { status: 'loading' } | { status: 'out' } | { status: 'in'; profile: Profile }


class NotPermittedError extends Error {}

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadData())
  const [fullData, setData] = useState<SchoolData>(initial.data)
  const [persistent, setPersistent] = useState(initial.persistent)
  const [loadProblem, setLoadProblem] = useState<string | null>(initial.problem ?? null)
  const [auth, setAuth] = useState<Auth>({ status: 'loading' })
  // True while a sign-in is checked here, so the background listener doesn't load the profile twice.
  const signingIn = useRef(false)
  // The owner can narrow the administrator pages to one branch (kept for this browser session).
  const [ownerBranchId, setOwnerBranchId] = useState<string | null>(() => readOwnerBranch())
  const now = useNow()

  const user = useMemo(() => (auth.status === 'in' ? userFromProfile(auth.profile, fullData.users) : null), [auth, fullData.users])
  const userId = user?.id ?? null

  // Restore the signed-in account when the site opens, and follow sign-outs
  // (including from another tab, or an expired session).
  useEffect(() => {
    let alive = true
    const load = async (authUserId: string | undefined) => {
      if (!authUserId) {
        if (alive) setAuth({ status: 'out' })
        return
      }
      try {
        const profile = await fetchMyProfile(authUserId)
        if (!alive) return
        if (profile) setAuth({ status: 'in', profile })
        else {
          // The account was turned off or removed: end the session.
          await supabase.auth.signOut()
          if (alive) setAuth({ status: 'out' })
        }
      } catch {
        // Offline or the server didn't answer: stay signed out rather than guess.
        if (alive) setAuth({ status: 'out' })
      }
    }
    void supabase.auth.getSession().then(({ data }) => load(data.session?.user.id))
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setAuth({ status: 'out' })
      else if (event === 'SIGNED_IN' && session && !signingIn.current) void load(session.user.id)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])
  const ownerBranch = user?.role === 'owner' && fullData.branches.some((b) => b.id === ownerBranchId) ? ownerBranchId : null
  const data = useMemo(() => {
    if (!user) return fullData
    if (user.role === 'owner') return ownerBranch ? branchData(fullData, ownerBranch) : fullData
    return scopeData(fullData, user)
  }, [fullData, user, ownerBranch])

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

  // Every change is stamped with who made it, for the audit history.
  const actorRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    actorRef.current = userId ?? undefined
  }, [userId])
  const update = useCallback(
    (change: (prev: SchoolData) => SchoolData) =>
      setData((prev) => {
        const next = change(prev)
        if (next.activity === prev.activity || !actorRef.current) return next
        const known = new Set(prev.activity.map((a) => a.id))
        return { ...next, activity: next.activity.map((a) => (known.has(a.id) || a.byUserId ? a : { ...a, byUserId: actorRef.current })) }
      }),
    [],
  )

  /** Checks the username and password with the server. `ownerPage` is true on the owner's sign-in page. */
  const signInWith = useCallback(
    async (username: string, password: string, ownerPage: boolean): Promise<SignInResult> => {
      if (!username.trim() || !password) return { error: tr("Enter your username and password.") }
      signingIn.current = true
      try {
        const { data: signed, error } = await supabase.auth.signInWithPassword({ email: loginEmail(username), password })
        if (error || !signed.user) {
          const offline = !error || /fetch|network|failed to/i.test(error.message)
          return { error: offline ? tr("Can’t reach the server. Check the internet connection and try again.") : tr("Wrong username or password.") }
        }
        const profile = await fetchMyProfile(signed.user.id)
        if (!profile) {
          await supabase.auth.signOut()
          return { error: tr("This account is turned off. Ask the owner to turn it back on.") }
        }
        if (signsInOnOwnerPage(profile.role) !== ownerPage) {
          await supabase.auth.signOut()
          return { error: ownerPage ? tr("This page is only for the owner. Staff sign in on the main sign-in page.") : tr("The owner signs in on the Owner sign-in page.") }
        }
        setAuth({ status: 'in', profile })
        return { user: userFromProfile(profile, fullData.users) }
      } catch {
        return { error: tr("Can’t reach the server. Check the internet connection and try again.") }
      } finally {
        signingIn.current = false
      }
    },
    [fullData.users],
  )
  const signIn = useCallback((username: string, password: string) => signInWith(username, password, false), [signInWith])
  const signInOwner = useCallback((username: string, password: string) => signInWith(username, password, true), [signInWith])

  const signOut = useCallback(() => {
    void supabase.auth.signOut()
    setAuth({ status: 'out' })
    setOwnerBranchId(null)
    try {
      window.sessionStorage.removeItem(OWNER_BRANCH_KEY)
    } catch {
      // Ignore.
    }
  }, [])

  const setOwnerBranch = useCallback((branchId: string | null) => {
    setOwnerBranchId(branchId)
    try {
      if (branchId) window.sessionStorage.setItem(OWNER_BRANCH_KEY, branchId)
      else window.sessionStorage.removeItem(OWNER_BRANCH_KEY)
    } catch {
      // Ignore: the choice lasts until refresh.
    }
  }, [])

  const actions = useMemo<SchoolActions>(() => {
    const groupName = (d: SchoolData, id: string | null) => d.groups.find((g) => g.id === id)?.name
    // For the owner, the branch they've narrowed the pages to (new teachers, rooms and enquiries go there).
    const actorBranch = user?.role === 'owner' ? ownerBranch : user ? userBranchId(fullData, user) : null

    // Administrators (and later the owner) manage records; teachers can't.
    // The UI never offers these to teachers, so a call is a programming error.
    // Course → Level → Group: a group must sit in a real level of a real course; its course and level names are copied on.
    const labelled = (g: Group): Group => {
      const { course, level } = levelOf(fullData.courses, g)
      if (!course || !level) throw new Error('Choose the group’s course and level.')
      return withGroupLabels([g], fullData.courses)[0]
    }
    const requireOwner = () => {
      if (user?.role !== 'owner') throw new NotPermittedError('Only the owner can do this.')
    }
    const requireManager = () => {
      if (!user || user.role === 'teacher') throw new NotPermittedError('Only administrators can change this.')
    }
    // An administrator may only change records in their own branch.
    const requireInBranch = (branchId: string | undefined) => {
      requireManager()
      if (user && BRANCH_STAFF_ROLES.includes(user.role) && branchId !== user.branchId) {
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
        const student: Student = { guardians: [], ...input, id: createId('stu'), branchId: branchForGroup(input.groupId) }
        requireInBranch(student.branchId)
        update((d) =>
          withActivity(
            applyStudentChange(d, { before: undefined, after: student, on: student.enrolledOn, byUserId: user?.id }),
            activity('student_added', 'Student registered', `${student.fullName} joined ${groupName(d, student.groupId) ?? 'the centre (no group yet)'}`, student.branchId),
          ),
        )
        return student
      },
      importStudents(inputs) {
        requireManager()
        if (inputs.length === 0) return []
        const students: Student[] = inputs.map((input) => ({ guardians: [], ...input, id: createId('stu'), branchId: branchForGroup(input.groupId) }))
        for (const s of students) requireInBranch(s.branchId)
        // One save for the whole file, so a half-finished import can't happen.
        update((d) => {
          let next = d
          for (const s of students) next = applyStudentChange(next, { before: undefined, after: s, on: s.enrolledOn, byUserId: user?.id })
          const branches = [...new Set(students.map((s) => s.branchId))]
          return withActivity(next, activity('student_added', 'Students imported from Excel', `${students.length} ${students.length === 1 ? 'student' : 'students'} added`, branches.length === 1 ? branches[0] : undefined))
        })
        return students
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
          const current = d.students.find((s) => s.id === id)!
          const after: Student = { ...current, ...input, id, branchId }
          if (!input.tuitionAdjustment) delete after.tuitionAdjustment
          if (!input.tags?.length) delete after.tags
          return withActivity(applyStudentChange(d, { before: current, after, on: toISODate(new Date()), byUserId: user?.id }), entry)
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
              homeworkResults: d.homeworkResults.filter((r) => r.studentId !== id),
              studentNotes: d.studentNotes.filter((n) => n.studentId !== id),
              enrollments: d.enrollments.filter((e) => e.studentId !== id),
              studentEvents: d.studentEvents.filter((e) => e.studentId !== id),
              assessments: d.assessments.map((a) => ({ ...a, results: a.results.filter((r) => r.studentId !== id) })),
              attendance,
            },
            activity('student_removed', 'Student record deleted', student?.fullName ?? 'A student', student?.branchId),
          )
        })
      },

      // Only the owner adds, edits or removes teachers.
      addTeacher(input) {
        requireOwner()
        // New teachers join the branch the owner has chosen at the top of the page.
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
        requireOwner()
        const before = fullData.teachers.find((t) => t.id === id)
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
        requireOwner()
        const teacher = fullData.teachers.find((t) => t.id === id)
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
        const group = labelled({ ...input, id: createId('grp'), branchId })
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
              groups: d.groups.map((g) => (g.id === id ? labelled({ ...input, id, branchId }) : g)),
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
              enrollments: d.enrollments.map((e) => (e.groupId === id && !e.endedOn ? { ...e, endedOn: toISODate(new Date()), endReason: `${name} was deleted` } : e)),
              assessments: d.assessments.filter((a) => a.groupId !== id),
              attendance: d.attendance.filter((r) => r.groupId !== id),
              homework: d.homework.filter((h) => h.groupId !== id),
              homeworkResults: d.homeworkResults.filter((r) => d.homework.find((h) => h.id === r.homeworkId)?.groupId !== id),
            },
            activity('group_changed', 'Group deleted', `${name}. Its students are now unassigned`, group?.branchId),
          )
        })
      },

      saveAttendance(groupId, date, marks, comments, grades) {
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
        // Grades only for students marked as attending, and only 1–5.
        const cleanGrades = grades
          ? Object.fromEntries(
              Object.entries(grades).filter(([id, g]) => allowed.has(id) && cleanMarks[id] && cleanMarks[id] !== 'absent' && cleanMarks[id] !== 'excused' && [1, 2, 3, 4, 5].includes(g)),
            )
          : existing?.grades
        const record = {
          id: existing?.id ?? createId('att'),
          groupId,
          date,
          // Keep the time and teacher the class actually had, if already recorded.
          startTime: existing?.startTime ?? group.startTime,
          teacherId: existing?.teacherId ?? group.teacherId,
          marks: cleanMarks,
          ...(Object.keys(cleanComments).length > 0 ? { comments: cleanComments } : {}),
          ...(cleanGrades && Object.keys(cleanGrades).length > 0 ? { grades: cleanGrades } : {}),
          savedAt: new Date().toISOString(),
          recordedBy: user.id,
        }
        const values = Object.values(cleanMarks)
        const attended = values.filter((m) => m === 'present' || m === 'late').length
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
        const today = toISODate(new Date())
        const homework = {
          ...input,
          id: createId('hw'),
          teacherId: group.teacherId,
          assignedOn: today,
          // Everyone in the group today gets a result row for this homework.
          studentIds: homeworkStudents(fullData.students, group.id, today),
          createdAt: new Date().toISOString(),
        }
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
        const group = before && teachableGroup(before.groupId)
        if (!before || !group) return false
        const changes = { title: input.title, description: input.description, dueDate: input.dueDate, resource: input.resource || undefined }
        update((d) =>
          withActivity(
            { ...d, homework: d.homework.map((h) => (h.id === id ? { ...h, ...changes, updatedAt: new Date().toISOString() } : h)) },
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
            { ...d, homework: d.homework.filter((h) => h.id !== id), homeworkResults: d.homeworkResults.filter((r) => r.homeworkId !== id) },
            activity('homework_changed', 'Homework removed', `${group.name}: ${before.title}`, group.branchId),
          ),
        )
        return true
      },
      saveHomeworkResults(homeworkId, rows) {
        const homework = fullData.homework.find((h) => h.id === homeworkId)
        const group = homework && teachableGroup(homework.groupId)
        if (!homework || !group || !user) return null
        const now = new Date()
        const today = toISODate(now)
        const assigned = new Set(homework.studentIds)
        const existing = new Map(fullData.homeworkResults.filter((r) => r.homeworkId === homeworkId).map((r) => [r.studentId, r]))
        const next = new Map(existing)
        let changed = 0

        for (const row of rows) {
          // Only students the homework was set for, and only valid scores.
          if (!assigned.has(row.studentId)) continue
          const score = row.score === null ? null : Math.round(row.score)
          if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) continue
          const before = existing.get(row.studentId)
          const feedback = row.feedback.trim().slice(0, 1000)
          // A score means the work was handed in.
          const submission = score !== null && row.submission === 'not_submitted' ? 'submitted' : row.submission
          const same =
            (before?.submission ?? 'not_submitted') === submission &&
            (before?.evaluation?.score ?? null) === score &&
            (score === null || before?.evaluation?.feedback === feedback)
          if (same) continue
          changed += 1
          if (submission === 'not_submitted' && score === null) {
            next.delete(row.studentId)
            continue
          }
          const result: HomeworkResult = {
            id: before?.id ?? `res_${homeworkId}_${row.studentId}`,
            homeworkId,
            studentId: row.studentId,
            submission,
            ...(submission !== 'not_submitted' ? { submittedOn: before?.submittedOn ?? today } : {}),
            ...(score !== null
              ? {
                  evaluation:
                    before?.evaluation && before.evaluation.score === score && before.evaluation.feedback === feedback
                      ? before.evaluation
                      : { score, feedback, evaluatedAt: now.toISOString(), evaluatedBy: user.id },
                }
              : {}),
            updatedAt: now.toISOString(),
          }
          next.set(row.studentId, result)
        }
        if (changed === 0) return 0
        update((d) =>
          withActivity(
            { ...d, homeworkResults: [...d.homeworkResults.filter((r) => r.homeworkId !== homeworkId), ...next.values()] },
            activity('homework_changed', 'Homework evaluated', `${group.name}: ${homework.title} (${changed} ${changed === 1 ? 'student' : 'students'})`, group.branchId),
          ),
        )
        return changed
      },

      addStudentNote(studentId, text, important) {
        const student = fullData.students.find((s) => s.id === studentId)
        const clean = text.trim().slice(0, 1000)
        if (!student || !user || !clean) return null
        // Teachers: students in their groups. Administrators: their branch.
        const allowed = user.role === 'teacher' ? Boolean(teachableGroup(student.groupId ?? '')) : user.role === 'owner' || student.branchId === user.branchId
        if (!allowed) return null
        const note: StudentNote = { id: createId('note'), studentId, authorId: user.id, authorName: user.fullName, text: clean, important, createdAt: new Date().toISOString() }
        update((d) => ({ ...d, studentNotes: [note, ...d.studentNotes] }))
        return note
      },
      deleteStudentNote(id) {
        const note = fullData.studentNotes.find((n) => n.id === id)
        if (!note || !user || note.authorId !== user.id) return false
        update((d) => ({ ...d, studentNotes: d.studentNotes.filter((n) => n.id !== id) }))
        return true
      },

      addPayment(input) {
        const student = fullData.students.find((s) => s.id === input.studentId)
        requireInBranch(student?.branchId)
        const draft: Payment = { ...input, id: createId('pay'), ...(user ? { recordedBy: user.id } : {}) }
        // Next receipt number for the student's branch, e.g. CH-000124.
        const payment = withReceipts([...fullData.payments, draft], fullData.students).find((p) => p.id === draft.id)!
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
            {
              ...d,
              payments: d.payments.map((p) => {
                if (p.id !== id) return p
                const changes = (['amount', 'date', 'period', 'method', 'status', 'note'] as const)
                  .filter((k) => (p[k] ?? '') !== (input[k] ?? ''))
                  .map((k) => `${k}: ${p[k] ?? '—'} → ${input[k] ?? '—'}`)
                const history = changes.length ? [...(p.history ?? []), { at: new Date().toISOString(), byUserId: user?.id, change: changes.join('; ') }] : p.history
                return { ...p, ...input, id, ...(history ? { history } : {}) }
              }),
            },
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

      refundPayment(id, reason) {
        const payment = fullData.payments.find((p) => p.id === id)
        const student = fullData.students.find((s) => s.id === payment?.studentId)
        requireInBranch(student?.branchId)
        if (!payment || payment.status === 'refunded') return
        update((d) =>
          withActivity(
            {
              ...d,
              payments: d.payments.map((p) =>
                p.id === id ? { ...p, status: 'refunded' as const, history: [...(p.history ?? []), { at: new Date().toISOString(), byUserId: user?.id, change: `Refunded: ${reason.trim() || 'no reason given'}` }] } : p,
              ),
            },
            activity('payment_recorded', 'Payment refunded', `${student?.fullName ?? 'A student'}: ${formatUZS(payment.amount)}. ${reason}`, student?.branchId),
          ),
        )
      },

      addListItem(list, name) {
        requireManager()
        const entry: ListItem = { id: createId(list.slice(0, 4)), name: name.trim(), active: true }
        update((d) => withActivity({ ...d, catalogs: { ...d.catalogs, [list]: [...d.catalogs[list], entry] } }, activity('settings_changed', 'List updated', `Added “${entry.name}”`)))
        return entry
      },
      renameListItem(list, id, name) {
        requireManager()
        update((d) => ({ ...d, catalogs: { ...d.catalogs, [list]: d.catalogs[list].map((x) => (x.id === id ? { ...x, name: name.trim() } : x)) } }))
      },
      setListItemActive(list, id, active) {
        requireManager()
        update((d) => ({ ...d, catalogs: { ...d.catalogs, [list]: d.catalogs[list].map((x) => (x.id === id ? { ...x, active } : x)) } }))
      },
      updateCourse(id, input) {
        requireManager()
        const before = fullData.courses.find((c) => c.id === id)
        if (!before) throw new Error('That course no longer exists.')
        const problem = checkCourse(fullData.courses, id, input.name, input.levels)
        if (problem) throw new Error(problem)
        // A level can only be removed while no group uses it (turning it off is always allowed).
        const kept = new Set(input.levels.map((l) => l.id))
        const inUse = fullData.groups.find((g) => g.courseId === id && !kept.has(g.levelId))
        if (inUse) throw new Error(`${inUse.name} is in a level you removed. Move the group first, or turn the level off instead.`)
        const name = input.name.trim().replace(/\s+/g, ' ')
        const levels = input.levels.map((l) => ({ ...l, name: l.name.trim().replace(/\s+/g, ' ') }))
        const rename = (value: string) => (value === before.name ? name : value)
        update((d) => {
          const courses = d.courses.map((c) => (c.id === id ? { ...c, name, levels, defaultFee: input.defaultFee } : c))
          return withActivity(
            {
              ...d,
              courses,
              // The course and level names shown on groups, teachers, enquiries and assessments follow the rename.
              groups: withGroupLabels(d.groups, courses),
              teachers: name === before.name ? d.teachers : d.teachers.map((t) => ({ ...t, subject: rename(t.subject) })),
              leads: name === before.name ? d.leads : d.leads.map((l) => ({ ...l, course: rename(l.course) })),
            },
            activity('settings_changed', 'Course updated', name === before.name ? name : `${before.name} → ${name}`),
          )
        })
      },

      addExpense(input) {
        // Branch expenses by branch staff; organisation-wide ones (no branch) by the owner.
        if (input.branchId === null) requireOwner()
        else requireInBranch(input.branchId)
        const expense: Expense = { ...input, id: createId('exp'), createdBy: user?.id, createdAt: new Date().toISOString() }
        update((d) => withActivity({ ...d, expenses: [...d.expenses, expense] }, activity('expense_changed', 'Expense recorded', `${expense.description}: ${formatUZS(expense.amount)}`, expense.branchId ?? undefined)))
        return expense
      },
      updateExpense(id, input) {
        const before = fullData.expenses.find((e) => e.id === id)
        if (!before) return
        if (before.branchId === null || input.branchId === null) requireOwner()
        else {
          requireInBranch(before.branchId)
          requireInBranch(input.branchId)
        }
        update((d) =>
          withActivity(
            { ...d, expenses: d.expenses.map((e) => (e.id === id ? { ...e, ...input, updatedAt: new Date().toISOString() } : e)) },
            activity('expense_changed', 'Expense corrected', `${input.description}: ${formatUZS(before.amount)} → ${formatUZS(input.amount)}`, input.branchId ?? undefined),
          ),
        )
      },
      deleteExpense(id) {
        const before = fullData.expenses.find((e) => e.id === id)
        if (!before) return
        if (before.branchId === null) requireOwner()
        else requireInBranch(before.branchId)
        update((d) => withActivity({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }, activity('expense_changed', 'Expense deleted', `${before.description}: ${formatUZS(before.amount)}`, before.branchId ?? undefined)))
      },

      addSalaryPayment(input) {
        const teacher = fullData.teachers.find((t) => t.id === input.teacherId)
        requireInBranch(teacher?.branchId)
        const payment: SalaryPayment = { ...input, id: createId('sal'), paidBy: user?.id, createdAt: new Date().toISOString() }
        update((d) => withActivity({ ...d, salaryPayments: [...d.salaryPayments, payment] }, activity('salary_changed', 'Salary paid', `${teacher?.fullName}: ${formatUZS(payment.amount)} for ${payment.month}`, teacher?.branchId)))
        return payment
      },
      deleteSalaryPayment(id) {
        const payment = fullData.salaryPayments.find((p) => p.id === id)
        const teacher = fullData.teachers.find((t) => t.id === payment?.teacherId)
        requireInBranch(teacher?.branchId)
        update((d) => withActivity({ ...d, salaryPayments: d.salaryPayments.filter((p) => p.id !== id) }, activity('salary_changed', 'Salary payment removed', `${teacher?.fullName}: ${formatUZS(payment?.amount ?? 0)}`, teacher?.branchId)))
      },

      saveStaffAttendance(branchId, date, marks) {
        requireInBranch(branchId)
        const now = new Date().toISOString()
        const ids = new Set(marks.map((m) => m.personId))
        const rows: StaffAttendance[] = marks.map((m) => ({ ...m, id: `stf_${m.personId}_${date}`, branchId, date, recordedBy: user?.id, savedAt: now }))
        update((d) =>
          withActivity(
            { ...d, staffAttendance: [...d.staffAttendance.filter((r) => !(r.date === date && r.branchId === branchId && ids.has(r.personId))), ...rows] },
            activity('staff_attendance', 'Staff attendance saved', `${date}: ${rows.filter((r) => r.mark === 'present' || r.mark === 'late').length} of ${rows.length} at work`, branchId),
          ),
        )
      },

      addContactLog(input) {
        const branchId =
          input.subject.type === 'student' ? fullData.students.find((s) => s.id === input.subject.id)?.branchId : fullData.leads.find((l) => l.id === input.subject.id)?.branchId
        requireInBranch(branchId)
        const log: ContactLog = { ...input, id: createId('log'), branchId: branchId!, at: new Date().toISOString(), byUserId: user?.id }
        update((d) => withActivity({ ...d, contactLogs: [...d.contactLogs, log] }, activity('contact_logged', `${log.channel === 'call' ? 'Call' : log.channel === 'sms' ? 'SMS' : log.channel === 'telegram' ? 'Telegram message' : log.channel === 'visit' ? 'Visit' : 'Note'} logged`, log.summary, branchId)))
        return log
      },
      deleteContactLog(id) {
        const log = fullData.contactLogs.find((l) => l.id === id)
        requireInBranch(log?.branchId)
        update((d) => ({ ...d, contactLogs: d.contactLogs.filter((l) => l.id !== id) }))
      },

      addExtraLesson(input) {
        const student = fullData.students.find((s) => s.id === input.studentId)
        requireInBranch(student?.branchId)
        const lesson: ExtraLesson = { ...input, id: createId('xl'), branchId: student!.branchId, createdAt: new Date().toISOString() }
        update((d) => withActivity({ ...d, extraLessons: [...d.extraLessons, lesson] }, activity('student_updated', 'Extra lesson planned', `${student?.fullName}: ${lesson.topic}, ${lesson.date} ${lesson.time}`, lesson.branchId)))
        return lesson
      },
      updateExtraLesson(id, input) {
        const before = fullData.extraLessons.find((x) => x.id === id)
        requireInBranch(before?.branchId)
        update((d) => ({ ...d, extraLessons: d.extraLessons.map((x) => (x.id === id ? { ...x, ...input } : x)) }))
      },
      deleteExtraLesson(id) {
        const before = fullData.extraLessons.find((x) => x.id === id)
        requireInBranch(before?.branchId)
        update((d) => ({ ...d, extraLessons: d.extraLessons.filter((x) => x.id !== id) }))
      },

      addUser(input) {
        requireOwner()
        const created: User = { ...input, username: input.username.trim().toLowerCase(), id: createId('usr'), active: true, createdAt: new Date().toISOString() }
        update((d) => withActivity({ ...d, users: [...d.users, created] }, activity('user_changed', 'Account created', `${created.fullName} (${created.role})`, created.branchId ?? undefined)))
        return created
      },
      updateUser(id, input) {
        requireOwner()
        const before = fullData.users.find((u) => u.id === id)
        update((d) =>
          withActivity(
            { ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...input, username: input.username.trim().toLowerCase() } : u)) },
            activity(
              'user_changed',
              before && before.branchId !== input.branchId ? 'Branch assignment changed' : 'Account updated',
              `${input.fullName}${before && before.branchId !== input.branchId ? `: ${before.branchId ?? 'none'} → ${input.branchId ?? 'none'}` : ''}`,
              input.branchId ?? undefined,
            ),
          ),
        )
      },
      setUserActive(id, active) {
        requireOwner()
        const target = fullData.users.find((u) => u.id === id)
        if (!target || target.role === 'owner') return
        update((d) => withActivity({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, active } : u)) }, activity('user_changed', active ? 'Account turned on' : 'Account turned off', target.fullName, target.branchId ?? undefined)))
      },

      transferStudent(studentId, input) {
        const student = fullData.students.find((s) => s.id === studentId)
        const target = fullData.groups.find((g) => g.id === input.toGroupId)
        requireInBranch(student?.branchId)
        requireInBranch(target?.branchId)
        if (!student || !target || student.groupId === target.id) return
        const after: Student = {
          ...student,
          groupId: target.id,
          branchId: target.branchId,
          ...(input.monthlyTuition !== undefined ? { monthlyTuition: input.monthlyTuition } : {}),
          // Leaving the archive by transfer makes them active again.
          status: isArchived(student.status) ? 'active' : student.status,
        }
        update((d) =>
          withActivity(
            applyStudentChange(d, { before: student, after, on: input.on, reason: input.reason?.trim() || undefined, byUserId: user?.id }),
            activity('group_changed', 'Student transferred', `${student.fullName}: ${groupName(d, student.groupId) ?? 'no group'} → ${target.name}`, target.branchId),
          ),
        )
      },
      changeStudentStatus(studentId, status, on, reason) {
        const student = fullData.students.find((s) => s.id === studentId)
        requireInBranch(student?.branchId)
        if (!student || student.status === status) return
        // Leaving or graduating frees the seat; pausing keeps it.
        const after: Student = { ...student, status, groupId: isArchived(status) ? null : student.groupId }
        update((d) =>
          withActivity(
            applyStudentChange(d, { before: student, after, on, reason: reason?.trim() || undefined, byUserId: user?.id }),
            activity('student_updated', 'Student status changed', `${student.fullName}: ${status}`, student.branchId),
          ),
        )
      },

      addLead(input) {
        requireManager()
        const now = new Date().toISOString()
        const lead: Lead = { ...input, id: createId('lead'), branchId: actorBranch ?? DEFAULT_BRANCH_ID, stage: 'new', createdAt: now, updatedAt: now }
        update((d) => withActivity({ ...d, leads: [lead, ...d.leads] }, activity('lead_changed', 'New enquiry', `${lead.studentName}, ${lead.course}`, lead.branchId)))
        return lead
      },
      updateLead(id, changes) {
        const lead = fullData.leads.find((l) => l.id === id)
        requireInBranch(lead?.branchId)
        if (!lead) return
        // Only stages on the owner's list (shared by every branch).
        if (changes.stage !== undefined && !fullData.leadStages.some((s) => s.id === changes.stage)) throw new Error(`Unknown admissions stage "${changes.stage}".`)
        update((d) => ({ ...d, leads: d.leads.map((l) => (l.id === id ? { ...l, ...changes, updatedAt: new Date().toISOString() } : l)) }))
      },

      addLeadStage(input) {
        requireOwner()
        const problem = stageNameProblem(fullData.leadStages, input.name)
        if (problem) throw new Error(problem)
        const stage = { id: createId('stage'), name: input.name.trim().replace(/\s+/g, ' '), color: input.color }
        update((d) => withActivity({ ...d, leadStages: withStageAdded(d.leadStages, stage) }, activity('owner_changed', 'Admissions stage added', stage.name)))
        return stage
      },
      updateLeadStage(id, input) {
        requireOwner()
        const before = fullData.leadStages.find((s) => s.id === id)
        if (!before) return
        const problem = stageNameProblem(fullData.leadStages, input.name, id)
        if (problem) throw new Error(problem)
        const clean = input.name.trim().replace(/\s+/g, ' ')
        // A built-in stage given back its default name keeps following translations.
        const name = isSystemStage(id) && (clean === tr(SYSTEM_STAGE_NAME[id]) || clean === SYSTEM_STAGE_NAME[id]) ? undefined : clean
        const oldName = stageName(fullData.leadStages, id)
        update((d) =>
          withActivity(
            { ...d, leadStages: d.leadStages.map((s) => (s.id === id ? { id, color: input.color, ...(name ? { name } : {}) } : s)) },
            activity('owner_changed', 'Admissions stage changed', oldName === clean ? clean : `${oldName} → ${clean}`),
          ),
        )
      },
      moveLeadStage(id, direction) {
        requireOwner()
        update((d) => ({ ...d, leadStages: withStageMoved(d.leadStages, id, direction) }))
      },
      deleteLeadStage(id, moveLeadsTo) {
        requireOwner()
        // Checked against every branch's enquiries, not just the branch on screen.
        const result = deleteStage(fullData, id, moveLeadsTo)
        if (!result.ok) return result
        const name = stageName(fullData.leadStages, id)
        const target = moveLeadsTo ? stageName(fullData.leadStages, moveLeadsTo) : ''
        update((d) => {
          const again = deleteStage(d, id, moveLeadsTo)
          if (!again.ok) return d
          return withActivity(again.data, activity('owner_changed', 'Admissions stage deleted', again.moved ? `${name}: ${again.moved} enquiries moved to ${target}` : name))
        })
        return { ok: true, moved: result.moved }
      },
      deleteLead(id) {
        const lead = fullData.leads.find((l) => l.id === id)
        requireInBranch(lead?.branchId)
        update((d) => ({ ...d, leads: d.leads.filter((l) => l.id !== id) }))
      },
      enrollLead(leadId, input) {
        const lead = fullData.leads.find((l) => l.id === leadId)
        requireInBranch(lead?.branchId)
        const student: Student = { guardians: [], ...input, id: createId('stu'), branchId: branchForGroup(input.groupId) }
        requireInBranch(student.branchId)
        update((d) => {
          let next = applyStudentChange(d, { before: undefined, after: student, on: student.enrolledOn, byUserId: user?.id })
          next = {
            ...next,
            leads: next.leads.map((l) => (l.id === leadId ? { ...l, stage: 'enrolled' as const, studentId: student.id, updatedAt: new Date().toISOString() } : l)),
            studentEvents: [
              ...next.studentEvents,
              { id: createId('evt'), studentId: student.id, type: 'created_from_lead' as const, on: student.enrolledOn, title: 'Came through admissions', detail: lead ? `Enquiry from ${lead.source ?? 'unknown source'}${lead.placement ? `, placed at ${lead.placement.level}` : ''}` : undefined, at: new Date().toISOString(), ...(user ? { byUserId: user.id } : {}) },
            ],
          }
          return withActivity(next, activity('student_added', 'Enquiry enrolled', `${student.fullName} joined ${groupName(d, student.groupId) ?? 'the centre'}`, student.branchId))
        })
        return student
      },

      addAssessment(input) {
        const group = teachableGroup(input.groupId)
        if (!group) return null
        const assessment: Assessment = { ...input, id: createId('asm'), results: [], createdBy: user?.id, createdAt: new Date().toISOString() }
        update((d) => withActivity({ ...d, assessments: [...d.assessments, assessment] }, activity('assessment_changed', 'Assessment planned', `${group.name}: ${assessment.title}`, group.branchId)))
        return assessment
      },
      updateAssessment(id, input) {
        const before = fullData.assessments.find((a) => a.id === id)
        const group = before && teachableGroup(before.groupId)
        if (!before || !group) return false
        // Scores above a lowered maximum would be invalid, so they're capped.
        const results = before.results.map((r) => (r.score !== null && r.score > input.maxScore ? { ...r, score: input.maxScore } : r))
        update((d) => ({ ...d, assessments: d.assessments.map((a) => (a.id === id ? { ...a, ...input, groupId: before.groupId, results, updatedAt: new Date().toISOString() } : a)) }))
        return true
      },
      saveAssessmentResults(id, results) {
        const before = fullData.assessments.find((a) => a.id === id)
        const group = before && teachableGroup(before.groupId)
        if (!before || !group) return false
        const clean = results
          .filter((r) => r.score === null || (Number.isFinite(r.score) && r.score >= 0 && r.score <= before.maxScore))
          .map((r) => ({ studentId: r.studentId, score: r.score, ...(r.comment?.trim() ? { comment: r.comment.trim().slice(0, 300) } : {}) }))
        update((d) =>
          withActivity(
            { ...d, assessments: d.assessments.map((a) => (a.id === id ? { ...a, results: clean, updatedAt: new Date().toISOString() } : a)) },
            activity('assessment_changed', 'Assessment results saved', `${group.name}: ${before.title}`, group.branchId),
          ),
        )
        return true
      },
      deleteAssessment(id) {
        const before = fullData.assessments.find((a) => a.id === id)
        if (!before || !teachableGroup(before.groupId)) return false
        update((d) => ({ ...d, assessments: d.assessments.filter((a) => a.id !== id) }))
        return true
      },

      addCourse(name) {
        requireManager()
        const course: Course = { id: createId('crs'), name: name.trim(), active: true, levels: [] }
        update((d) => withActivity({ ...d, courses: [...d.courses, course] }, activity('settings_changed', 'Course added', course.name)))
        return course
      },
      setCourseActive(id, active) {
        requireManager()
        update((d) => ({ ...d, courses: d.courses.map((c) => (c.id === id ? { ...c, active } : c)) }))
      },
      addRoom(input) {
        requireManager()
        const room: Room = { id: createId('room'), branchId: actorBranch ?? DEFAULT_BRANCH_ID, name: input.name.trim(), ...(input.capacity ? { capacity: input.capacity } : {}) }
        update((d) => ({ ...d, rooms: [...d.rooms, room] }))
        return room
      },
      updateRoom(id, input) {
        const room = fullData.rooms.find((r) => r.id === id)
        requireInBranch(room?.branchId)
        if (!room) return
        const name = input.name.trim()
        update((d) => ({
          ...d,
          rooms: d.rooms.map((r) => (r.id === id ? { ...r, name, capacity: input.capacity || undefined } : r)),
          // Renaming a room renames it on the groups that use it.
          groups: d.groups.map((g) => (g.branchId === room.branchId && g.room === room.name ? { ...g, room: name } : g)),
        }))
      },
      deleteRoom(id) {
        const room = fullData.rooms.find((r) => r.id === id)
        requireInBranch(room?.branchId)
        if (!room || fullData.groups.some((g) => g.branchId === room.branchId && g.room === room.name && g.status !== 'completed')) return false
        update((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id) }))
        return true
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
      transferTeacher(teacherId, toBranchId, on) {
        requireOwner()
        const teacher = fullData.teachers.find((t) => t.id === teacherId)
        const to = fullData.branches.find((b) => b.id === toBranchId)
        if (!teacher || !to) return { ok: false, reason: 'Choose a teacher and a branch.' }
        if (teacher.branchId === to.id) return { ok: false, reason: `${teacher.fullName} already works at ${to.name}.` }
        const groups = fullData.groups.filter((g) => g.teacherId === teacherId && g.status !== 'completed')
        if (groups.length) {
          return { ok: false, reason: `${teacher.fullName} still teaches ${groups.map((g) => g.name).join(', ')}. Give these groups another teacher first; a group stays at its branch.` }
        }
        const from = fullData.branches.find((b) => b.id === teacher.branchId)
        update((d) =>
          withActivity(
            {
              ...d,
              teachers: d.teachers.map((t) =>
                t.id === teacherId
                  ? { ...t, branchId: to.id, branchHistory: [...(t.branchHistory ?? [{ branchId: t.branchId, from: t.joinedOn }]), { branchId: to.id, from: on }] }
                  : t,
              ),
              notifications: [
                ...d.notifications,
                notice({ kind: 'admin', title: `You’re moving to the ${to.name} branch`, body: `From ${on} you work at ${to.name} (${to.address}).`, audience: { teacherId } }),
              ],
            },
            activity('teacher_changed', 'Teacher moved to another branch', `${teacher.fullName}: ${from?.name ?? '—'} → ${to.name}, from ${on}`, to.id),
          ),
        )
        return { ok: true }
      },
      awardBonus(input) {
        requireOwner()
        const bonus: Bonus = { ...input, id: createId('bonus'), awardedAt: new Date().toISOString(), awardedBy: user!.id }
        const teacher = fullData.teachers.find((t) => t.id === input.teacherId)
        update((d) =>
          withActivity({ ...d, bonuses: [...d.bonuses, bonus] }, activity('owner_changed', 'Bonus awarded', `${teacher?.fullName ?? 'A teacher'}: ${formatUZS(bonus.amount)}`, teacher?.branchId)),
        )
        return bonus
      },
      deleteBonus(id) {
        requireOwner()
        update((d) => ({ ...d, bonuses: d.bonuses.filter((b) => b.id !== id) }))
      },
      updateBranch(id, input) {
        requireOwner()
        update((d) =>
          withActivity(
            { ...d, branches: d.branches.map((b) => (b.id === id ? { ...b, address: input.address.trim(), phone: input.phone.trim() } : b)) },
            activity('owner_changed', 'Branch details updated', d.branches.find((b) => b.id === id)?.name ?? 'A branch'),
          ),
        )
      },

      resetDemoData() {
        requireManager()
        setData(createDemoData(new Date()))
        setLoadProblem(null)
      },
    }
  }, [update, fullData, user, ownerBranch])

  const balances = useMemo(() => computeBalances(data, now), [data, now])
  // Pay and rating need everyone's payments and lessons, so they're worked out
  // here from the full data; the teacher only receives the results.
  const month = monthKey(now)
  const today = toISODate(now)
  const teacherView = useMemo<TeacherView | null>(() => {
    const teacher = user?.role === 'teacher' ? fullData.teachers.find((t) => t.id === user.teacherId) : undefined
    if (!teacher) return null
    return {
      teacher,
      salary: salaryHistory(fullData, teacher.id, month, 6),
      ratings: [month, addMonths(month, -1)].map((m) => ({ month: m, rows: teacherRatings(fullData, m, parseISODate(today)) })),
    }
    // Recalculated when data changes or the day turns, not every minute.
  }, [fullData, user, month, today])
  const branch = useMemo(() => {
    const id = user?.role === 'owner' ? ownerBranch : user ? userBranchId(fullData, user) : null
    return fullData.branches.find((b) => b.id === id) ?? null
  }, [fullData, user, ownerBranch])
  const owner = useMemo<OwnerView | null>(
    () => (user?.role === 'owner' ? { data: fullData, branchId: ownerBranch, setBranch: setOwnerBranch } : null),
    [user, fullData, ownerBranch, setOwnerBranch],
  )

  const value = useMemo<SchoolContextValue>(
    () => ({
      data,
      now,
      balances,
      teacherView,
      persistent,
      loadProblem,
      dismissLoadProblem: () => setLoadProblem(null),
      actions,
      user,
      branch,
      authLoading: auth.status === 'loading',
      signIn,
      signInOwner,
      signOut,
      owner,
    }),
    [data, now, balances, teacherView, persistent, loadProblem, actions, user, branch, auth.status, signIn, signInOwner, signOut, owner],
  )

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

import { createContext, useContext } from 'react'
import type { AttendanceMark, Branch, Group, Homework, Payment, SchoolData, Settings, Student, Teacher, User } from '../types'
import type { TuitionBalance } from '../lib/metrics'

// The branch is never typed in: it follows the group, teacher or signed-in administrator.
export type StudentInput = Omit<Student, 'id' | 'branchId'>
export type TeacherInput = Omit<Teacher, 'id' | 'branchId'>
export type GroupInput = Omit<Group, 'id' | 'branchId'>
export type PaymentInput = Omit<Payment, 'id'>
export type HomeworkInput = Pick<Homework, 'groupId' | 'title' | 'description' | 'dueDate'>

export interface SchoolActions {
  addStudent(input: StudentInput): Student
  updateStudent(id: string, input: StudentInput): void
  /** Also removes the student's payments and attendance marks. */
  deleteStudent(id: string): void

  addTeacher(input: TeacherInput): Teacher
  updateTeacher(id: string, input: TeacherInput): void
  /** Refused while the teacher still has groups. */
  deleteTeacher(id: string): boolean

  addGroup(input: GroupInput): Group
  updateGroup(id: string, input: GroupInput): void
  /** Students in the group become unassigned; its attendance history is removed. */
  deleteGroup(id: string): void

  /** Refused (returns false) for a group the signed-in person doesn't teach or manage. */
  saveAttendance(
    groupId: string,
    date: string,
    marks: Record<string, AttendanceMark>,
    comments?: Record<string, string>,
  ): boolean

  /** Each returns null/false for a group the signed-in person doesn't teach or manage. */
  addHomework(input: HomeworkInput): Homework | null
  updateHomework(id: string, input: HomeworkInput): boolean
  deleteHomework(id: string): boolean

  addPayment(input: PaymentInput): Payment
  updatePayment(id: string, input: PaymentInput): void
  deletePayment(id: string): void

  updateSettings(settings: Settings): void
  /** Marks notifications read for the signed-in person only. */
  markNotificationsRead(ids: string[]): void
  /** Throws away every local change and regenerates the sample data. */
  resetDemoData(): void
}

export interface SchoolContextValue {
  /** Only what the signed-in person may see (their branch, or their groups). */
  data: SchoolData
  now: Date
  /** Tuition balance for every visible student, derived from payments. */
  balances: Map<string, TuitionBalance>
  /** false when changes cannot be kept after a refresh. */
  persistent: boolean
  loadProblem: string | null
  dismissLoadProblem(): void
  actions: SchoolActions

  /** Demo sign-in (see lib/auth.ts). null when signed out. */
  user: User | null
  /** The signed-in person's branch; null for the owner. */
  branch: Branch | null
  /** Accounts that can sign in, for the demo sign-in page. */
  demoAccounts: User[]
  signIn(username: string, password: string): User | null
  signOut(): void
}

export const SchoolContext = createContext<SchoolContextValue | null>(null)

export function useSchool(): SchoolContextValue {
  const value = useContext(SchoolContext)
  if (!value) throw new Error('useSchool must be used inside <SchoolProvider>')
  return value
}

/** The signed-in user, for pages that only render behind a sign-in check. */
export function useUser(): User {
  const { user } = useSchool()
  if (!user) throw new Error('useUser needs a signed-in user')
  return user
}

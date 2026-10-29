import { createContext, useContext } from 'react'
import type { AttendanceMark, Group, Payment, SchoolData, Settings, Student, Teacher } from '../types'
import type { TuitionBalance } from '../lib/metrics'

export type StudentInput = Omit<Student, 'id'>
export type TeacherInput = Omit<Teacher, 'id'>
export type GroupInput = Omit<Group, 'id'>
export type PaymentInput = Omit<Payment, 'id'>

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

  saveAttendance(groupId: string, date: string, marks: Record<string, AttendanceMark>): void

  addPayment(input: PaymentInput): Payment
  updatePayment(id: string, input: PaymentInput): void
  deletePayment(id: string): void

  updateSettings(settings: Settings): void
  markNotificationsRead(ids: string[]): void
  /** Throws away every local change and regenerates the sample data. */
  resetDemoData(): void
}

export interface SchoolContextValue {
  data: SchoolData
  now: Date
  /** Tuition balance for every student, derived from payments. */
  balances: Map<string, TuitionBalance>
  /** false when changes cannot be kept after a refresh. */
  persistent: boolean
  loadProblem: string | null
  dismissLoadProblem(): void
  actions: SchoolActions
}

export const SchoolContext = createContext<SchoolContextValue | null>(null)

export function useSchool(): SchoolContextValue {
  const value = useContext(SchoolContext)
  if (!value) throw new Error('useSchool must be used inside <SchoolProvider>')
  return value
}

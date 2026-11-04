import { createContext, useContext } from 'react'
import type {
  Assessment,
  AssessmentResult,
  AttendanceMark,
  Branch,
  Course,
  Grade,
  MonthKey,
  Group,
  Homework,
  Lead,
  Payment,
  Room,
  SchoolData,
  Settings,
  Student,
  StudentNote,
  StudentStatus,
  SubmissionState,
  Teacher,
  User,
} from '../types'
import type { TuitionBalance } from '../lib/metrics'
import type { SalaryMonth } from '../lib/salary'
import type { TeacherRating } from '../lib/rating'

// The branch is never typed in: it follows the group, teacher or signed-in administrator.
type StudentProfile = 'guardians' | 'dateOfBirth' | 'gender' | 'address'
/** The administrator's student form. Profile details are kept as they are unless given. */
export type StudentInput = Omit<Student, 'id' | 'branchId' | StudentProfile> & Partial<Pick<Student, StudentProfile>>
export type TeacherInput = Omit<Teacher, 'id' | 'branchId'>
export type GroupInput = Omit<Group, 'id' | 'branchId'>
export type PaymentInput = Omit<Payment, 'id' | 'recordedBy'>
/** A new enquiry. Stage, trial and placement are changed with updateLead. */
export type LeadInput = Pick<Lead, 'studentName' | 'parentName' | 'phone' | 'course' | 'source' | 'notes'>
export type LeadUpdate = Partial<Pick<Lead, 'studentName' | 'parentName' | 'phone' | 'course' | 'source' | 'notes' | 'stage' | 'trial' | 'placement' | 'lostReason'>>
export type AssessmentInput = Pick<Assessment, 'groupId' | 'title' | 'kind' | 'date' | 'maxScore'>
export type RoomInput = Pick<Room, 'name' | 'capacity'>

export interface TransferInput {
  toGroupId: string
  /** The first day in the new group. */
  on: string
  reason?: string
  /** New monthly tuition, e.g. the new group's fee. Left out, it stays as it is. */
  monthlyTuition?: number
}
/** The group can't change after homework is set: its students already have results. */
export type HomeworkInput = Pick<Homework, 'groupId' | 'title' | 'description' | 'dueDate' | 'resource'>

/** One row of the evaluation table. A score makes the result "evaluated". */
export interface ResultInput {
  studentId: string
  submission: SubmissionState
  score: number | null
  feedback: string
}

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
    /** Lesson grades. Left out, the lesson keeps the grades it already had. */
    grades?: Record<string, Grade>,
  ): boolean

  /** Each returns null/false for a group the signed-in person doesn't teach or manage. */
  addHomework(input: HomeworkInput): Homework | null
  updateHomework(id: string, input: HomeworkInput): boolean
  deleteHomework(id: string): boolean
  /** Saves results for students the homework was set for; returns how many changed, or null if refused. */
  saveHomeworkResults(homeworkId: string, rows: ResultInput[]): number | null

  /** Notes are for staff only. Teachers can delete their own notes. */
  addStudentNote(studentId: string, text: string, important: boolean): StudentNote | null
  deleteStudentNote(id: string): boolean

  /** Moves a student to another group at their branch and keeps the old membership in their history. */
  transferStudent(studentId: string, input: TransferInput): void
  /** Pause, leave, graduate or reactivate. Leaving or graduating ends the group membership. */
  changeStudentStatus(studentId: string, status: StudentStatus, on: string, reason?: string): void

  addLead(input: LeadInput): Lead
  updateLead(id: string, update: LeadUpdate): void
  deleteLead(id: string): void
  /** Creates the student from the enquiry and marks it enrolled. */
  enrollLead(leadId: string, input: StudentInput): Student

  /** Assessments are for groups the person teaches or manages; null/false otherwise. */
  addAssessment(input: AssessmentInput): Assessment | null
  updateAssessment(id: string, input: AssessmentInput): boolean
  saveAssessmentResults(id: string, results: AssessmentResult[]): boolean
  deleteAssessment(id: string): boolean

  addCourse(name: string): Course
  setCourseActive(id: string, active: boolean): void
  /** Rooms belong to the administrator's branch. */
  addRoom(input: RoomInput): Room
  updateRoom(id: string, input: RoomInput): void
  /** Refused while a group uses the room. */
  deleteRoom(id: string): boolean

  addPayment(input: PaymentInput): Payment
  updatePayment(id: string, input: PaymentInput): void
  deletePayment(id: string): void

  updateSettings(settings: Settings): void
  /** Marks notifications read for the signed-in person only. */
  markNotificationsRead(ids: string[]): void
  /** Throws away every local change and regenerates the sample data. */
  resetDemoData(): void
}

/** Pay and rating for the signed-in teacher, worked out from data they can't see directly. */
export interface TeacherView {
  teacher: Teacher
  /** Last six months, newest first. */
  salary: SalaryMonth[]
  /** This month and last month, every teacher, best first. */
  ratings: { month: MonthKey; rows: TeacherRating[] }[]
}

export interface SchoolContextValue {
  /** Only what the signed-in person may see (their branch, or their groups). */
  data: SchoolData
  now: Date
  /** Tuition balance for every visible student, derived from payments. */
  balances: Map<string, TuitionBalance>
  /** Only for a signed-in teacher; null for everyone else. */
  teacherView: TeacherView | null
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

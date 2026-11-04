import { createContext, useContext } from 'react'
import type {
  Assessment,
  Bonus,
  Catalogs,
  ContactLog,
  Expense,
  ExtraLesson,
  ListItem,
  SalaryPayment,
  StaffAttendance,
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

export type BonusInput = Pick<Bonus, 'teacherId' | 'month' | 'place' | 'amount' | 'note'>
export type CatalogName = keyof Catalogs
export type ExpenseInput = Pick<Expense, 'branchId' | 'categoryId' | 'amount' | 'date' | 'description' | 'paidTo' | 'method'>
export type SalaryPaymentInput = Pick<SalaryPayment, 'teacherId' | 'month' | 'amount' | 'date' | 'method' | 'note'>
export type ContactLogInput = Pick<ContactLog, 'subject' | 'channel' | 'direction' | 'withWhom' | 'summary' | 'followUpOn'>
export type ExtraLessonInput = Pick<ExtraLesson, 'studentId' | 'teacherId' | 'date' | 'time' | 'durationMinutes' | 'topic' | 'fee' | 'status' | 'paid'>
export type UserInput = Pick<User, 'fullName' | 'username' | 'role' | 'branchId' | 'phone'>
export type StaffMarkInput = Pick<StaffAttendance, 'personId' | 'personType' | 'mark' | 'arrivedAt' | 'note'>
export type BranchInput = Pick<Branch, 'address' | 'phone'>

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

  /** Owner only. Refused (with a reason) while the teacher still has running or paused groups. */
  transferTeacher(teacherId: string, toBranchId: string, on: string): { ok: true } | { ok: false; reason: string }
  /** Owner only. */
  awardBonus(input: BonusInput): Bonus
  deleteBonus(id: string): void
  updateBranch(id: string, input: BranchInput): void

  /** Marks a payment refunded and records why. The payment stays in the history. */
  refundPayment(id: string, reason: string): void

  /** Lists the school manages (payment methods, expense categories, tags, reasons, sources). */
  addListItem(list: CatalogName, name: string): ListItem
  renameListItem(list: CatalogName, id: string, name: string): void
  setListItemActive(list: CatalogName, id: string, active: boolean): void
  updateCourse(id: string, input: { levels: string[]; defaultFee?: number }): void

  addExpense(input: ExpenseInput): Expense
  updateExpense(id: string, input: ExpenseInput): void
  deleteExpense(id: string): void

  addSalaryPayment(input: SalaryPaymentInput): SalaryPayment
  deleteSalaryPayment(id: string): void

  /** Saves who came to work on a day at the branch (replaces that day's marks for these people). */
  saveStaffAttendance(branchId: string, date: string, marks: StaffMarkInput[]): void

  addContactLog(input: ContactLogInput): ContactLog
  deleteContactLog(id: string): void

  addExtraLesson(input: ExtraLessonInput): ExtraLesson
  updateExtraLesson(id: string, input: ExtraLessonInput): void
  deleteExtraLesson(id: string): void

  /** Owner only: front-office accounts and branch assignments. Teachers' accounts come with their teacher record. */
  addUser(input: UserInput): User
  updateUser(id: string, input: UserInput): void
  setUserActive(id: string, active: boolean): void

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

/** The owner sees everything; administrator pages can be narrowed to one branch. */
export interface OwnerView {
  /** Every branch, unscoped. Owner pages read this. */
  data: SchoolData
  /** The branch the administrator pages are narrowed to; null = all branches. */
  branchId: string | null
  setBranch(branchId: string | null): void
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
  /** Accounts that can sign in, for the demo sign-in page (administrators and teachers). */
  demoAccounts: User[]
  signIn(username: string, password: string): User | null
  /** The owner's own demo sign-in (see OWNER_DEMO_CREDENTIALS). */
  signInOwner(username: string, password: string): User | null
  signOut(): void
  /** Only for the signed-in owner; null for everyone else. */
  owner: OwnerView | null
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

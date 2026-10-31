// Shared domain types for Sherov School.
// Dates are stored as ISO strings: "YYYY-MM-DD" for calendar days,
// full ISO timestamps for moments in time (activity, saves).
// Every record has a stable string id so it can move to a real database later.

export type ISODate = string // "2026-10-29"
export type ISODateTime = string // "2026-10-29T09:15:00.000Z"
export type MonthKey = string // "2026-10"

export const SUBJECTS = ['English', 'IELTS Preparation', 'Mathematics', 'Computer Science'] as const
export type Subject = (typeof SUBJECTS)[number]

/** Groups in Tashkent centres usually meet on "odd" or "even" days. */
export type DayPattern = 'odd' | 'even'
/** 1 = Monday … 7 = Sunday (ISO weekday). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

// ---------------------------------------------------------------- organisation

export interface Branch {
  id: string
  name: string
  address: string
  phone: string
}

/**
 * Who someone is in the app. The owner sees every branch, an administrator
 * manages one branch, a teacher works with their own groups only.
 */
export const ROLES = ['owner', 'admin', 'teacher'] as const
export type Role = (typeof ROLES)[number]

/** A person who can sign in. Never holds a password: demo sign-in lives in lib/auth.ts. */
export interface User {
  id: string
  role: Role
  fullName: string
  username: string
  /** The branch an administrator manages; null for the owner. */
  branchId: string | null
  /** For teachers: their teacher record (which carries the branch). */
  teacherId?: string
}

// ---------------------------------------------------------------- people and classes

export type TeacherStatus = 'active' | 'on_leave'
export interface Teacher {
  id: string
  fullName: string
  subject: Subject
  phone: string
  email: string
  status: TeacherStatus
  joinedOn: ISODate
  /** The one branch the teacher currently works at. Only the owner may change it. */
  branchId: string
}

export type GroupStatus = 'active' | 'paused' | 'completed'
export interface Group {
  id: string
  name: string
  subject: Subject
  teacherId: string
  /** Always the assigned teacher's branch. */
  branchId: string
  room: string
  days: DayPattern
  startTime: string // "HH:mm"
  durationMinutes: number
  capacity: number
  monthlyFee: number // UZS
  status: GroupStatus
}

export type StudentStatus = 'active' | 'paused' | 'left'
export interface Student {
  id: string
  fullName: string
  phone: string
  email?: string
  groupId: string | null
  /** Branch the student studies at (their group's branch while they have one). */
  branchId: string
  enrolledOn: ISODate
  monthlyTuition: number // UZS
  status: StudentStatus
}

export type AttendanceMark = 'present' | 'absent' | 'late'
/**
 * One class session: a group's class on a date, with a mark (and optional
 * comment) for each student. The teacher and start time are copied in when
 * saved so the history stays correct if the group's schedule changes later.
 */
export interface AttendanceRecord {
  id: string
  groupId: string
  date: ISODate
  startTime: string
  teacherId: string
  marks: Record<string, AttendanceMark> // studentId -> mark
  comments?: Record<string, string> // studentId -> note
  savedAt: ISODateTime
  /** User who last saved it, when known. */
  recordedBy?: string
}

export const PAYMENT_METHODS = ['cash', 'card', 'click', 'payme', 'transfer'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type PaymentStatus = 'paid' | 'pending' | 'refunded'
export interface Payment {
  id: string
  studentId: string
  amount: number // UZS
  date: ISODate
  period: MonthKey // which month of tuition this covers
  method: PaymentMethod
  status: PaymentStatus
  note?: string
}

export interface Homework {
  id: string
  groupId: string
  teacherId: string
  title: string
  description: string
  dueDate: ISODate
  createdAt: ISODateTime
  updatedAt?: ISODateTime
}

// ---------------------------------------------------------------- messages

export type NotificationKind = 'schedule' | 'announcement' | 'homework' | 'admin'

/** Who a notification is for. Every field given must match; none means everyone. */
export interface NotificationAudience {
  role?: Role
  branchId?: string
  teacherId?: string
}

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: ISODateTime
  audience: NotificationAudience
  /** In-app link, e.g. "/teacher/schedule". */
  link?: string
}

export type ActivityType =
  | 'student_added'
  | 'student_updated'
  | 'student_removed'
  | 'payment_recorded'
  | 'attendance_saved'
  | 'group_changed'
  | 'teacher_changed'
  | 'settings_changed'
  | 'homework_changed'
export interface Activity {
  id: string
  type: ActivityType
  title: string
  detail: string
  at: ISODateTime
  /** Branch the change belongs to; missing for centre-wide changes. */
  branchId?: string
}

export interface Settings {
  centerName: string
  phone: string
  email: string
  address: string
  workingHours: string
  currency: 'UZS'
  tuitionDueDay: number // day of month after which unpaid tuition is overdue
}

export interface SchoolData {
  version: number
  seededAt: ISODateTime
  branches: Branch[]
  users: User[]
  teachers: Teacher[]
  groups: Group[]
  students: Student[]
  attendance: AttendanceRecord[]
  payments: Payment[]
  homework: Homework[]
  notifications: Notification[]
  activity: Activity[]
  settings: Settings
  /** Notification ids each user has read, keyed by user id. */
  notificationReads: Record<string, string[]>
}

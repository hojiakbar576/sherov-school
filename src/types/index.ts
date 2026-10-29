// Shared domain types for Sherov School.
// Dates are stored as ISO strings: "YYYY-MM-DD" for calendar days,
// full ISO timestamps for moments in time (activity, saves).

export type ISODate = string // "2026-10-29"
export type ISODateTime = string // "2026-10-29T09:15:00.000Z"
export type MonthKey = string // "2026-10"

export const SUBJECTS = ['English', 'IELTS Preparation', 'Mathematics', 'Computer Science'] as const
export type Subject = (typeof SUBJECTS)[number]

/** Groups in Tashkent centres usually meet on "odd" or "even" days. */
export type DayPattern = 'odd' | 'even'
/** 1 = Monday … 7 = Sunday (ISO weekday). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type TeacherStatus = 'active' | 'on_leave'
export interface Teacher {
  id: string
  fullName: string
  subject: Subject
  phone: string
  email: string
  status: TeacherStatus
  joinedOn: ISODate
}

export type GroupStatus = 'active' | 'paused' | 'completed'
export interface Group {
  id: string
  name: string
  subject: Subject
  teacherId: string
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
  enrolledOn: ISODate
  monthlyTuition: number // UZS
  status: StudentStatus
}

export type AttendanceMark = 'present' | 'absent' | 'late'
/** One class session: a group on a date, with a mark for each student. */
export interface AttendanceRecord {
  id: string
  groupId: string
  date: ISODate
  marks: Record<string, AttendanceMark> // studentId -> mark
  savedAt: ISODateTime
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

export type ActivityType =
  | 'student_added'
  | 'student_updated'
  | 'student_removed'
  | 'payment_recorded'
  | 'attendance_saved'
  | 'group_changed'
  | 'teacher_changed'
  | 'settings_changed'
export interface Activity {
  id: string
  type: ActivityType
  title: string
  detail: string
  at: ISODateTime
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
  teachers: Teacher[]
  groups: Group[]
  students: Student[]
  attendance: AttendanceRecord[]
  payments: Payment[]
  activity: Activity[]
  settings: Settings
  readNotificationIds: string[]
}

// Shared domain types for Sherov School.
// Dates are stored as ISO strings: "YYYY-MM-DD" for calendar days,
// full ISO timestamps for moments in time (activity, saves).
// Every record has a stable string id so it can move to a real database later.

export type ISODate = string // "2026-10-29"
export type ISODateTime = string // "2026-10-29T09:15:00.000Z"
export type MonthKey = string // "2026-10"

/** The courses the demo starts with. The live list is `SchoolData.courses`. */
export const SUBJECTS = ['English', 'IELTS Preparation', 'Mathematics', 'Computer Science'] as const
/** A course name, e.g. "English". Groups and teachers keep the name; the list of courses is data. */
export type Subject = string

/**
 * One level of a course, e.g. "Intermediate" or "Band 6.5". Each centre names
 * its own levels; groups point at a level by id, so renaming it is safe.
 */
export interface CourseLevel {
  id: string
  name: string
  /** Turned-off levels stay on old groups but can't be chosen for new ones. */
  active: boolean
}

/**
 * A course (program) the centre offers, e.g. "General English" or "IELTS".
 * The academic structure is Course → Level → Group. New courses and levels
 * are added in Settings, without code changes.
 */
export interface Course {
  id: string
  name: Subject
  /** Inactive courses stay on old groups but can't be chosen for new ones. */
  active: boolean
  /** Levels in teaching order, e.g. Beginner → Elementary → … */
  levels: CourseLevel[]
  /** Usual monthly fee for a new group of this course (UZS). */
  defaultFee?: number
}

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
 * Who someone is in the app. There is one owner, who sees every branch. Each
 * branch has one administrator (who also runs the front desk) and one
 * accountant (see app/permissions.ts); teachers work with their own groups.
 */
export const ROLES = ['owner', 'admin', 'accountant', 'teacher'] as const
export type Role = (typeof ROLES)[number]
/** Roles that work at one branch's front office. Each branch has exactly one active account of each. */
export const BRANCH_STAFF_ROLES: readonly Role[] = ['admin', 'accountant']

/** The active account that already holds this branch role, if any (each branch has one administrator and one accountant). */
export function branchSeatHolder(users: readonly User[], role: Role, branchId: string | null, exceptId?: string): User | undefined {
  if (!BRANCH_STAFF_ROLES.includes(role) || !branchId) return undefined
  return users.find((u) => u.id !== exceptId && u.role === role && u.branchId === branchId && u.active !== false)
}

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
  /** Deactivated accounts can't sign in; their history stays. Missing means active. */
  active?: boolean
  phone?: string
  createdAt?: ISODateTime
}

/**
 * An entry in a list the school manages itself (payment methods, expense
 * categories, tags, reasons...). Inactive entries stay on old records but
 * can't be chosen for new ones.
 */
export interface ListItem {
  id: string
  name: string
  active: boolean
}

export interface Catalogs {
  paymentMethods: ListItem[]
  expenseCategories: ListItem[]
  studentTags: ListItem[]
  /** Reasons offered when a student is paused (frozen). */
  pauseReasons: ListItem[]
  /** Reasons offered when a student leaves. */
  leaveReasons: ListItem[]
  leadSources: ListItem[]
}

/** A classroom at one branch. Groups are scheduled into rooms. */
export interface Room {
  id: string
  branchId: string
  name: string
  capacity?: number
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
  /**
   * The teacher's share of the tuition their students pay, in percent (e.g. 40).
   * Set by the administrator; salary = paid tuition × this share (lib/salary.ts).
   */
  salaryPercent: number
  /** Branches worked at, oldest first, so a move between branches keeps its history. */
  branchHistory?: { branchId: string; from: ISODate }[]
  /**
   * How pay is worked out: a share of paid tuition (salaryPercent), a fixed
   * monthly amount, or both. Missing means "percent" (the original rule).
   */
  salaryKind?: SalaryKind
  /** Fixed monthly amount for "fixed" and "mixed" (UZS). */
  fixedSalary?: number
}

export type SalaryKind = 'percent' | 'fixed' | 'mixed'

export type GroupStatus = 'active' | 'paused' | 'completed'
export interface Group {
  id: string
  /** The centre's own label for the class, e.g. "INT-01". Not its classification. */
  name: string
  /** What the group teaches: Course → Level (see lib/courses.ts). */
  courseId: string
  levelId: string
  /** Copy of the course name, kept in step automatically. */
  subject: Subject
  teacherId: string
  /** Always the assigned teacher's branch. */
  branchId: string
  /** Room name at the group's branch (see `SchoolData.rooms`). */
  room: string
  /** Copy of the level name, kept in step automatically. */
  level?: string
  days: DayPattern
  /** Exact lesson days (1 = Monday … 7 = Sunday) when they don't follow the odd/even pattern. */
  weekdays?: Weekday[]
  startTime: string // "HH:mm"
  durationMinutes: number
  capacity: number
  monthlyFee: number // UZS
  status: GroupStatus
}

/**
 * Where a student is in their life at the centre. Only active students are
 * billed. Left and graduated students move to the archive with all history.
 */
export type StudentStatus = 'active' | 'paused' | 'left' | 'graduated'
export const CURRENT_STUDENT_STATUSES: readonly StudentStatus[] = ['active', 'paused']
export const ARCHIVED_STUDENT_STATUSES: readonly StudentStatus[] = ['left', 'graduated']

/** Why a student pays something other than their group's standard fee. */
export type TuitionAdjustmentKind = 'discount' | 'scholarship' | 'special_price'
export interface TuitionAdjustment {
  kind: TuitionAdjustmentKind
  reason: string
}
export type Gender = 'female' | 'male'

export const GUARDIAN_RELATIONSHIPS = ['mother', 'father', 'grandmother', 'grandfather', 'guardian'] as const
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number]

/** A parent or guardian. A student can have several; the first is the main contact. */
export interface Guardian {
  id: string
  fullName: string
  relationship: GuardianRelationship
  phone: string
  /** A second number, e.g. work or a relative. */
  altPhone?: string
}

export interface Student {
  id: string
  fullName: string
  /** The student's own phone, where they have one. */
  phone: string
  email?: string
  dateOfBirth?: ISODate
  gender?: Gender
  address?: string
  /** Parents or guardians, main contact first. Empty when not collected yet. */
  guardians: Guardian[]
  groupId: string | null
  /** Other groups the student also studies in (e.g. English and Maths). One shared balance. */
  extraGroupIds?: string[]
  /**
   * Balance carried over from the previous system (LC UP) on `asOf`: negative is debt,
   * positive is credit. While set, the student owes this minus payments made after it;
   * new monthly charges start once the centre's billing rules are switched on.
   */
  openingBalance?: { amount: number; asOf: ISODate; source: string }
  /** Branch the student studies at (their group's branch while they have one). */
  branchId: string
  enrolledOn: ISODate
  monthlyTuition: number // UZS
  /** Set when monthlyTuition differs from the group's fee, so everyone can see why. */
  tuitionAdjustment?: TuitionAdjustment
  status: StudentStatus
  /** Tag ids from Catalogs.studentTags, e.g. "Sibling", "VIP", "Needs follow-up". */
  tags?: string[]
}

/** A one-to-one or small extra lesson outside the group's timetable. */
export interface ExtraLesson {
  id: string
  studentId: string
  branchId: string
  teacherId: string
  date: ISODate
  time: string
  durationMinutes: number
  topic: string
  /** Extra fee (UZS); 0 when included. */
  fee: number
  status: 'planned' | 'done' | 'cancelled'
  paid: boolean
  createdAt: ISODateTime
}

/**
 * One stretch of a student in a group. A transfer ends one enrollment and
 * starts another, so history and reports stay correct. The open one (no
 * endedOn) matches `Student.groupId`.
 */
export interface Enrollment {
  id: string
  studentId: string
  groupId: string
  branchId: string
  startedOn: ISODate
  endedOn?: ISODate
  /** Why it ended, e.g. "Transferred to IELTS Foundation 5.5: level went up". */
  endReason?: string
}

export type StudentEventType = 'enrolled' | 'transferred' | 'status_changed' | 'tuition_changed' | 'created_from_lead'
/** Something that happened to a student, for their history timeline. */
export interface StudentEvent {
  id: string
  studentId: string
  type: StudentEventType
  on: ISODate
  title: string
  detail?: string
  /** Who did it, when known. */
  byUserId?: string
  at: ISODateTime
}

/** Excused absences (illness with notice, agreed leave) don't count against attendance. */
export type AttendanceMark = 'present' | 'absent' | 'late' | 'excused'
export const ATTENDANCE_MARKS: readonly AttendanceMark[] = ['present', 'late', 'absent', 'excused']

/** Lesson grade on the usual Uzbek 5-point scale: 5 is excellent, 1 is very poor. */
export const GRADES = [5, 4, 3, 2, 1] as const
export type Grade = (typeof GRADES)[number]
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
  /** Lesson grades (1–5) for students who took part. Not every student gets one every lesson. */
  grades?: Record<string, Grade> // studentId -> grade
  savedAt: ISODateTime
  /** User who last saved it, when known. */
  recordedBy?: string
}

/** The payment methods the demo starts with. The live list is `Catalogs.paymentMethods`. */
export const PAYMENT_METHODS = ['cash', 'card', 'click', 'payme', 'transfer'] as const
/** An id from Catalogs.paymentMethods, e.g. "cash". */
export type PaymentMethod = string
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
  /** The user who recorded it, when known. */
  recordedBy?: string
  /** The group this payment is for, when known (a student may be in several). */
  groupId?: string
  /** Brought over from the previous system; already counted in the student's opening balance. */
  imported?: boolean
  /** Receipt number, given when the payment is recorded, e.g. "CH-000123". */
  receiptNo?: string
  /** Every correction after it was recorded, oldest first. */
  history?: { at: ISODateTime; byUserId?: string; change: string }[]
}

// ---------------------------------------------------------------- money going out

export interface Expense {
  id: string
  /** null = for the whole organisation (e.g. head-office marketing). */
  branchId: string | null
  categoryId: string
  amount: number // UZS
  date: ISODate
  description: string
  /** Who was paid, e.g. "Landlord" or a supplier. */
  paidTo?: string
  method?: PaymentMethod
  createdBy?: string
  createdAt: ISODateTime
  updatedAt?: ISODateTime
}

/** Money paid out to a teacher for a month's salary (or part of it). */
export interface SalaryPayment {
  id: string
  teacherId: string
  /** The month of work it pays for. */
  month: MonthKey
  amount: number // UZS
  date: ISODate
  method?: PaymentMethod
  note?: string
  paidBy?: string
  createdAt: ISODateTime
}

// ---------------------------------------------------------------- staff and communication

export type StaffMark = 'present' | 'late' | 'absent' | 'excused'
/** Whether a teacher or front-office member came to work on a day. */
export interface StaffAttendance {
  id: string
  branchId: string
  date: ISODate
  /** A teacher id or a user id. */
  personId: string
  personType: 'teacher' | 'user'
  mark: StaffMark
  /** Arrival time, e.g. "08:55". */
  arrivedAt?: string
  note?: string
  recordedBy?: string
  savedAt: ISODateTime
}

export type ContactChannel = 'call' | 'sms' | 'telegram' | 'visit' | 'note'
/**
 * A call, message or meeting with a student, parent or enquiry. Logged by
 * staff; the app doesn't send SMS or Telegram messages itself yet.
 */
export interface ContactLog {
  id: string
  branchId: string
  subject: { type: 'student' | 'lead'; id: string }
  channel: ContactChannel
  direction: 'outgoing' | 'incoming'
  /** Who was spoken to, e.g. "Mother" or the student's name. */
  withWhom?: string
  summary: string
  /** Planned follow-up date, if any. */
  followUpOn?: ISODate
  at: ISODateTime
  byUserId?: string
}

export interface Homework {
  id: string
  groupId: string
  teacherId: string
  title: string
  description: string
  /** Optional link or reference, e.g. "Workbook p. 54" or a URL. */
  resource?: string
  assignedOn: ISODate
  dueDate: ISODate
  /** Students in the group when it was set. They each get a result. */
  studentIds: string[]
  createdAt: ISODateTime
  updatedAt?: ISODateTime
}

/** Whether the student handed the work in. "Evaluated" is a result with a score. */
export type SubmissionState = 'not_submitted' | 'submitted' | 'late'

/** The teacher's assessment. Kept separate so other scales can be added later. */
export interface HomeworkEvaluation {
  /** 0–100. */
  score: number
  feedback: string
  evaluatedAt: ISODateTime
  evaluatedBy: string
}

/**
 * One student's result for one homework: the unit a future parent view or
 * ranking reads. Missing means "not submitted, not evaluated".
 */
export interface HomeworkResult {
  id: string
  homeworkId: string
  studentId: string
  submission: SubmissionState
  submittedOn?: ISODate
  evaluation?: HomeworkEvaluation
  updatedAt: ISODateTime
}

/** A teacher's note about a student. Staff only, never meant for parents. */
export interface StudentNote {
  id: string
  studentId: string
  authorId: string
  authorName: string
  text: string
  important: boolean
  createdAt: ISODateTime
}

// ---------------------------------------------------------------- admissions

/**
 * The built-in admissions stages. The app's automatic steps move enquiries
 * into them (new enquiry → "new", booking a trial → "trial_scheduled",
 * recording its result → "trial_done", enrolling → "enrolled", marking lost →
 * "lost"), so they can be renamed, recoloured and reordered but not deleted.
 */
export const LEAD_STAGES = ['new', 'contacted', 'trial_scheduled', 'trial_done', 'enrolled', 'lost'] as const
export type SystemLeadStage = (typeof LEAD_STAGES)[number]
/** A stage id: one of LEAD_STAGES, or one the owner added (e.g. "stage_9f2c…"). */
export type LeadStage = string

export const LEAD_STAGE_COLORS = ['neutral', 'brand', 'accent', 'info', 'success', 'warning', 'danger'] as const
export type LeadStageColor = (typeof LEAD_STAGE_COLORS)[number]

/**
 * One column of the admissions board. The owner manages the list; it is
 * shared by every branch so reports compare like with like. The list order is
 * the board order; "enrolled" and "lost" are always kept last.
 */
export interface LeadStageDef {
  id: LeadStage
  /** The owner's name for it. Missing on a built-in stage = its default (translated) name. */
  name?: string
  color: LeadStageColor
}

export interface TrialLesson {
  date: ISODate
  time: string // "HH:mm"
  /** The group they sit in on, if any. */
  groupId?: string
  teacherId?: string
  /** null until the trial has happened. */
  attended: boolean | null
  outcome?: string
}

/** A simple level placement: the result and where the student should go. */
export interface Placement {
  level: string
  /** Free text, e.g. "34/50" or "B1". */
  score?: string
  recommendedGroupId?: string
  notes?: string
  on: ISODate
}

/** Someone interested in studying who isn't a student yet. */
export interface Lead {
  id: string
  branchId: string
  studentName: string
  parentName?: string
  phone: string
  course: Subject
  stage: LeadStage
  /** How they heard about the centre, e.g. "Instagram". */
  source?: string
  notes?: string
  trial?: TrialLesson
  placement?: Placement
  lostReason?: string
  /** The student record created when they enrolled. */
  studentId?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

// ---------------------------------------------------------------- assessments

export const ASSESSMENT_KINDS = ['level', 'monthly', 'midterm', 'final', 'other'] as const
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number]

export interface AssessmentResult {
  studentId: string
  /** null = absent / not taken. */
  score: number | null
  comment?: string
}

/** A test given to a group, scored out of maxScore. */
export interface Assessment {
  id: string
  groupId: string
  title: string
  kind: AssessmentKind
  date: ISODate
  maxScore: number
  results: AssessmentResult[]
  createdBy?: string
  createdAt: ISODateTime
  updatedAt?: ISODateTime
}

// ---------------------------------------------------------------- owner

/** A bonus the owner gave a teacher for a month, e.g. for a top-3 rating place. */
export interface Bonus {
  id: string
  teacherId: string
  month: MonthKey
  /** Rating place at the time, if it was awarded for the rating. */
  place?: number
  amount: number // UZS
  note?: string
  awardedAt: ISODateTime
  awardedBy: string
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
  | 'lead_changed'
  | 'assessment_changed'
  | 'owner_changed'
  | 'expense_changed'
  | 'salary_changed'
  | 'user_changed'
  | 'contact_logged'
  | 'staff_attendance'
export interface Activity {
  id: string
  type: ActivityType
  title: string
  detail: string
  at: ISODateTime
  /** Branch the change belongs to; missing for centre-wide changes. */
  branchId?: string
  /** Who did it, when known. */
  byUserId?: string
}

export interface Settings {
  centerName: string
  phone: string
  email: string
  address: string
  workingHours: string
  currency: 'UZS'
  tuitionDueDay: number // day of month after which unpaid tuition is overdue
  /** General settings, reasons, holidays and receipt fields. Read with generalSettings(). */
  general?: Partial<import('../lib/general-settings').GeneralSettings>
}

export interface SchoolData {
  version: number
  seededAt: ISODateTime
  branches: Branch[]
  courses: Course[]
  rooms: Room[]
  users: User[]
  teachers: Teacher[]
  groups: Group[]
  students: Student[]
  enrollments: Enrollment[]
  studentEvents: StudentEvent[]
  leads: Lead[]
  /** Admissions board columns, shared by all branches. Only the owner changes them. */
  leadStages: LeadStageDef[]
  assessments: Assessment[]
  bonuses: Bonus[]
  catalogs: Catalogs
  extraLessons: ExtraLesson[]
  expenses: Expense[]
  salaryPayments: SalaryPayment[]
  staffAttendance: StaffAttendance[]
  contactLogs: ContactLog[]
  attendance: AttendanceRecord[]
  payments: Payment[]
  homework: Homework[]
  homeworkResults: HomeworkResult[]
  studentNotes: StudentNote[]
  notifications: Notification[]
  activity: Activity[]
  settings: Settings
  /** Notification ids each user has read, keyed by user id. */
  notificationReads: Record<string, string[]>
}

// "General settings" (LC UP: Umumiy sozlamalar) plus the lists that sit beside
// them: reasons for each student/lead event, holidays and receipt fields.
// They live inside Settings as optional parts, so data saved before they
// existed still loads; read them through `generalSettings()` which fills gaps.

import type { ISODate, Settings } from '../types'
import type { Tone } from '../components/ui/tone'

export interface GeneralToggles {
  // Payments (stored now; the payment engine applies them when it is switched on)
  discountAffectsTeacher: boolean
  receiptAfterPayment: boolean
  choosePaymentDate: boolean
  askDiscountOnPayment: boolean
  discountCategories: boolean
  // Teachers
  teacherSeesOwnSalary: boolean
  teacherSeesSalaryReport: boolean
  alertMissingAttendance: boolean
  teacherSeesStudentData: boolean
  // Leads
  leadSmsVerify: boolean
}

export const TOGGLE_GROUPS: { group: 'payments' | 'teachers' | 'leads'; keys: (keyof GeneralToggles)[] }[] = [
  { group: 'payments', keys: ['discountAffectsTeacher', 'receiptAfterPayment', 'choosePaymentDate', 'askDiscountOnPayment', 'discountCategories'] },
  { group: 'teachers', keys: ['teacherSeesOwnSalary', 'teacherSeesSalaryReport', 'alertMissingAttendance', 'teacherSeesStudentData'] },
  { group: 'leads', keys: ['leadSmsVerify'] },
]

export const REASON_EVENTS = [
  'absent',
  'removedActive',
  'removedTrial',
  'removedFrozen',
  'returnedToTrial',
  'frozen',
  'leadRemoved',
  'removedFromGroup',
] as const
export type ReasonEvent = (typeof REASON_EVENTS)[number]

export interface Reason {
  id: string
  text: string
  tone: Tone
  createdAt: ISODate
  /** Absence reasons only: does the missed lesson still cost the student? */
  chargesStudent?: boolean
  /** Absence reasons only: is the teacher's share for that lesson withheld? */
  limitsTeacherShare?: boolean
}

export interface ReasonSettings {
  /** Must a reason be picked when this happens? */
  required: Record<ReasonEvent, boolean>
  /** Teachers may pick an absence reason while taking attendance. */
  teacherAddsAbsenceReason: boolean
  lists: Record<ReasonEvent, Reason[]>
}

export interface Holiday {
  id: string
  name: string
  date: ISODate
  /** Repeats on the same day every year (e.g. Navruz on 21 March). */
  everyYear: boolean
  /** Lessons that day are not charged to students. */
  affectsBalance: boolean
}

export const RECEIPT_FIELDS = ['receiptNo', 'amount', 'method', 'group', 'staff', 'teacher', 'student', 'time', 'centerName', 'note'] as const
export type ReceiptField = (typeof RECEIPT_FIELDS)[number]

export interface GeneralSettings {
  toggles: GeneralToggles
  reasons: ReasonSettings
  holidays: Holiday[]
  receipt: Record<ReceiptField, boolean>
}

export const DEFAULT_TOGGLES: GeneralToggles = {
  discountAffectsTeacher: true,
  receiptAfterPayment: true,
  choosePaymentDate: true,
  askDiscountOnPayment: true,
  discountCategories: false,
  teacherSeesOwnSalary: false,
  teacherSeesSalaryReport: false,
  alertMissingAttendance: true,
  teacherSeesStudentData: false,
  leadSmsVerify: false,
}

// Default ids are fixed (not random) so unsaved defaults keep the same ids between screens.
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const r = (text: string, tone: Tone, extra: Partial<Reason> = {}): Reason => ({ id: `rsn_${slug(text)}`, text, tone, createdAt: '2026-11-07', ...extra })

/** Starting reasons, taken from what centres usually record. Editable. */
export function defaultReasons(): ReasonSettings {
  return {
    required: Object.fromEntries(REASON_EVENTS.map((e) => [e, true])) as Record<ReasonEvent, boolean>,
    teacherAddsAbsenceReason: true,
    lists: {
      absent: [r('Betob', 'danger'), r('Viloyatga sayohat', 'info'), r('Maktabda', 'accent'), r('Musobaqada', 'warning')],
      removedActive: [r('Dam olmoqchi', 'danger'), r('Kurs tugatdi', 'accent'), r('Boshqa fan boshlamoqchi', 'info'), r('O‘qituvchi yoqmadi', 'warning'), r('Uzoqroqqa ko‘chib ketdi', 'brand'), r('Mos guruh topilmadi', 'neutral'), r('Moliyaviy sharoiti yo‘q', 'success'), r('Boshqa o‘quv markaziga ketdi', 'neutral')],
      removedTrial: [r('Boshqa joyga bormoqchi', 'warning'), r('Uzoqlik qilyapti', 'success'), r('Darajasiga mos guruh topilmadi', 'danger'), r('O‘qituvchi yoqmadi', 'neutral')],
      removedFrozen: [r('Rejalari o‘zgardi', 'success'), r('Uzoqlik qilyapti', 'brand'), r('Dam olmoqchi', 'danger'), r('Boshqa joyga bormoqchi', 'neutral')],
      returnedToTrial: [r('Xato qo‘shilgan', 'danger'), r('Boshqa guruhda o‘qimoqchi', 'warning')],
      frozen: [r('Dam olmoqchi', 'warning'), r('Betob', 'success'), r('Safarda', 'danger')],
      leadRemoved: [r('Keyinroq boshlaydi', 'danger'), r('Rejalari o‘zgardi', 'warning'), r('Xato qo‘shilgan', 'success'), r('Uzoqlik qilyapti', 'danger'), r('Viloyatda yashaydi', 'success'), r('Boshqa joyga bormoqchi', 'neutral'), r('Telefoni o‘chiq', 'info'), r('Telefonga javob bermayapti', 'neutral')],
      removedFromGroup: [r('Kurs tugatdi', 'info'), r('Boshqa guruhga o‘tdi', 'success'), r('Xato qo‘shilgan', 'accent')],
    },
  }
}

export function defaultHolidays(): Holiday[] {
  const h = (name: string, date: ISODate, everyYear: boolean): Holiday => ({ id: `hol_${date}`, name, date, everyYear, affectsBalance: false })
  return [
    h('Yangi yil', '2027-01-01', true),
    h('Xotin-qizlar kuni', '2026-03-08', true),
    h('Navro‘z', '2026-03-21', true),
    h('Xotira va qadrlash kuni', '2026-05-09', true),
    h('Mustaqillik kuni', '2026-09-01', true),
    h('O‘qituvchilar kuni', '2026-10-01', true),
    h('Konstitutsiya kuni', '2026-12-08', true),
  ]
}

export const DEFAULT_RECEIPT: Record<ReceiptField, boolean> = Object.fromEntries(RECEIPT_FIELDS.map((f) => [f, true])) as Record<ReceiptField, boolean>

/** Settings with every general part filled in, even for data saved before they existed. */
export function generalSettings(s: Settings): GeneralSettings {
  const saved = s.general
  const base = defaultReasons()
  return {
    toggles: { ...DEFAULT_TOGGLES, ...saved?.toggles },
    reasons: saved?.reasons
      ? {
          required: { ...base.required, ...saved.reasons.required },
          teacherAddsAbsenceReason: saved.reasons.teacherAddsAbsenceReason ?? base.teacherAddsAbsenceReason,
          lists: { ...base.lists, ...saved.reasons.lists },
        }
      : base,
    holidays: saved?.holidays ?? defaultHolidays(),
    receipt: { ...DEFAULT_RECEIPT, ...saved?.receipt },
  }
}

/** Is this date a holiday? Yearly holidays match on month and day. */
export function holidayOn(holidays: Holiday[], date: ISODate): Holiday | undefined {
  return holidays.find((h) => h.date === date || (h.everyYear && h.date.slice(5) === date.slice(5)))
}

/** Reason text is required and must not repeat within the same list (ignoring case and spaces). */
export function reasonError(list: Reason[], text: string, exceptId?: string): string | null {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length < 2) return 'Enter a reason.'
  if (list.some((x) => x.id !== exceptId && x.text.toLowerCase() === clean.toLowerCase())) return 'That reason is already on the list.'
  return null
}

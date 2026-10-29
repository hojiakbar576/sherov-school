import type {
  Activity,
  AttendanceMark,
  AttendanceRecord,
  Group,
  ISODate,
  Payment,
  PaymentMethod,
  SchoolData,
  Settings,
  Student,
  StudentStatus,
  Teacher,
} from '../types'
import {
  addDays,
  addMonths,
  atTime,
  daysInMonth,
  minutesSinceMidnight,
  monthKey,
  monthKeyOf,
  monthRange,
  startOfWeek,
  timeToMinutes,
  toISODate,
} from '../lib/dates'
import { createRandom, type Random } from '../lib/random'
import { meetsOn } from '../lib/schedule'
import { FEMALE_FIRST_NAMES, MALE_FIRST_NAMES, PHONE_PREFIXES, SURNAMES } from './names'

/** Bump when the stored data shape changes; older saved data is then set aside. */
export const DATA_VERSION = 1
/** How many months of tuition history the demo covers (including this month). */
export const HISTORY_MONTHS = 6

export const DEFAULT_SETTINGS: Settings = {
  centerName: 'Sherov School',
  phone: '+998 71 200 00 00',
  email: 'hello@sherovschool.uz',
  address: 'Chilonzor district, Tashkent, Uzbekistan',
  workingHours: 'Mon–Sat, 08:00–20:00',
  currency: 'UZS',
  tuitionDueDay: 10,
}

const TEACHERS: Teacher[] = [
  { id: 'tch_01', fullName: 'Dilshod Karimov', subject: 'English', phone: '+998 90 312 44 18', email: 'dilshod.karimov@sherovschool.uz', status: 'active', joinedOn: '2021-09-01' },
  { id: 'tch_02', fullName: 'Nigora Rahimova', subject: 'English', phone: '+998 93 540 21 07', email: 'nigora.rahimova@sherovschool.uz', status: 'active', joinedOn: '2022-02-14' },
  { id: 'tch_03', fullName: 'Kamola Yusupova', subject: 'IELTS Preparation', phone: '+998 97 708 63 52', email: 'kamola.yusupova@sherovschool.uz', status: 'active', joinedOn: '2021-09-01' },
  { id: 'tch_04', fullName: 'Javlon Tursunov', subject: 'IELTS Preparation', phone: '+998 99 155 90 34', email: 'javlon.tursunov@sherovschool.uz', status: 'active', joinedOn: '2023-08-21' },
  { id: 'tch_05', fullName: 'Sherzod Nazarov', subject: 'Mathematics', phone: '+998 94 621 08 77', email: 'sherzod.nazarov@sherovschool.uz', status: 'active', joinedOn: '2022-01-10' },
  { id: 'tch_06', fullName: 'Feruza Saidova', subject: 'Mathematics', phone: '+998 91 403 76 29', email: 'feruza.saidova@sherovschool.uz', status: 'active', joinedOn: '2023-01-16' },
  { id: 'tch_07', fullName: 'Bobur Ismoilov', subject: 'Computer Science', phone: '+998 88 290 14 63', email: 'bobur.ismoilov@sherovschool.uz', status: 'active', joinedOn: '2022-09-05' },
  { id: 'tch_08', fullName: 'Madina Xolmatova', subject: 'Computer Science', phone: '+998 95 836 52 40', email: 'madina.xolmatova@sherovschool.uz', status: 'active', joinedOn: '2024-02-01' },
  { id: 'tch_09', fullName: 'Aziza Qodirova', subject: 'English', phone: '+998 33 477 39 81', email: 'aziza.qodirova@sherovschool.uz', status: 'active', joinedOn: '2024-09-02' },
  { id: 'tch_10', fullName: 'Otabek Ergashev', subject: 'Mathematics', phone: '+998 90 958 27 15', email: 'otabek.ergashev@sherovschool.uz', status: 'on_leave', joinedOn: '2023-09-04' },
]

type GroupSeed = Omit<Group, 'durationMinutes' | 'status'> & { fill: number; status?: Group['status'] }

// Hand-planned timetable: no teacher or room is double-booked.
// `fill` is how many active students the group starts with.
const GROUPS: GroupSeed[] = [
  { id: 'grp_01', name: 'English Beginner A', subject: 'English', teacherId: 'tch_01', room: 'Room 101', days: 'odd', startTime: '09:00', capacity: 16, monthlyFee: 450_000, fill: 13 },
  { id: 'grp_02', name: 'English Elementary B', subject: 'English', teacherId: 'tch_01', room: 'Room 101', days: 'even', startTime: '14:00', capacity: 16, monthlyFee: 450_000, fill: 13 },
  { id: 'grp_03', name: 'English Pre-Intermediate', subject: 'English', teacherId: 'tch_02', room: 'Room 102', days: 'odd', startTime: '15:30', capacity: 14, monthlyFee: 480_000, fill: 14 },
  { id: 'grp_04', name: 'English Intermediate', subject: 'English', teacherId: 'tch_02', room: 'Room 102', days: 'even', startTime: '17:00', capacity: 18, monthlyFee: 500_000, fill: 15 },
  { id: 'grp_05', name: 'Kids English Starters', subject: 'English', teacherId: 'tch_09', room: 'Room 103', days: 'odd', startTime: '14:00', capacity: 12, monthlyFee: 400_000, fill: 11 },
  { id: 'grp_06', name: 'English Upper-Intermediate', subject: 'English', teacherId: 'tch_09', room: 'Room 103', days: 'even', startTime: '15:30', capacity: 16, monthlyFee: 520_000, fill: 13 },
  { id: 'grp_07', name: 'IELTS Foundation 5.5', subject: 'IELTS Preparation', teacherId: 'tch_03', room: 'Room 201', days: 'odd', startTime: '17:00', capacity: 18, monthlyFee: 650_000, fill: 15 },
  { id: 'grp_08', name: 'IELTS Intensive 6.5+', subject: 'IELTS Preparation', teacherId: 'tch_03', room: 'Room 201', days: 'even', startTime: '18:30', capacity: 12, monthlyFee: 750_000, fill: 12 },
  { id: 'grp_09', name: 'IELTS Speaking Club', subject: 'IELTS Preparation', teacherId: 'tch_04', room: 'Room 202', days: 'even', startTime: '11:00', capacity: 18, monthlyFee: 350_000, fill: 15 },
  { id: 'grp_10', name: 'IELTS General 6.0', subject: 'IELTS Preparation', teacherId: 'tch_04', room: 'Room 202', days: 'odd', startTime: '18:30', capacity: 14, monthlyFee: 650_000, fill: 12 },
  { id: 'grp_11', name: 'Mathematics Grade 7–8', subject: 'Mathematics', teacherId: 'tch_05', room: 'Room 203', days: 'odd', startTime: '14:00', capacity: 16, monthlyFee: 450_000, fill: 13 },
  { id: 'grp_12', name: 'University Admission Math', subject: 'Mathematics', teacherId: 'tch_05', room: 'Room 203', days: 'even', startTime: '17:00', capacity: 18, monthlyFee: 550_000, fill: 15 },
  { id: 'grp_13', name: 'SAT Math', subject: 'Mathematics', teacherId: 'tch_06', room: 'Room 204', days: 'odd', startTime: '17:00', capacity: 12, monthlyFee: 700_000, fill: 10 },
  { id: 'grp_14', name: 'Mathematics Grade 9–11', subject: 'Mathematics', teacherId: 'tch_06', room: 'Room 204', days: 'even', startTime: '15:30', capacity: 14, monthlyFee: 500_000, fill: 12 },
  { id: 'grp_15', name: 'Python Basics', subject: 'Computer Science', teacherId: 'tch_07', room: 'Computer Lab', days: 'odd', startTime: '15:30', capacity: 12, monthlyFee: 600_000, fill: 12 },
  { id: 'grp_16', name: 'Web Development', subject: 'Computer Science', teacherId: 'tch_07', room: 'Computer Lab', days: 'even', startTime: '17:00', capacity: 12, monthlyFee: 650_000, fill: 10 },
  { id: 'grp_17', name: 'Computer Literacy', subject: 'Computer Science', teacherId: 'tch_08', room: 'Computer Lab', days: 'odd', startTime: '11:00', capacity: 12, monthlyFee: 400_000, fill: 9 },
  { id: 'grp_18', name: 'Scratch for Kids', subject: 'Computer Science', teacherId: 'tch_08', room: 'Computer Lab', days: 'even', startTime: '14:00', capacity: 14, monthlyFee: 400_000, fill: 11 },
  { id: 'grp_19', name: 'English for Adults', subject: 'English', teacherId: 'tch_01', room: 'Room 101', days: 'even', startTime: '09:00', capacity: 14, monthlyFee: 500_000, fill: 12 },
  { id: 'grp_20', name: 'IELTS Writing Workshop', subject: 'IELTS Preparation', teacherId: 'tch_03', room: 'Room 201', days: 'odd', startTime: '11:00', capacity: 14, monthlyFee: 550_000, fill: 11 },
  { id: 'grp_21', name: 'English Summer Intensive', subject: 'English', teacherId: 'tch_02', room: 'Room 102', days: 'odd', startTime: '09:00', capacity: 16, monthlyFee: 600_000, fill: 0, status: 'completed' },
]

const PAYMENT_METHOD_WEIGHTS: [PaymentMethod, number][] = [
  ['cash', 0.34],
  ['card', 0.3],
  ['click', 0.2],
  ['payme', 0.12],
  ['transfer', 0.04],
]

/** Students differ in how reliably they pay and how often they attend. */
type PayerProfile = 'prompt' | 'late' | 'behind'
type AttendanceProfile = 'steady' | 'irregular'

interface GeneratedStudent {
  student: Student
  payer: PayerProfile
  attendance: AttendanceProfile
  payDay: number
}

function pickMethod(rand: Random): PaymentMethod {
  let roll = rand.next()
  for (const [method, weight] of PAYMENT_METHOD_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return method
  }
  return 'cash'
}

function makeName(rand: Random, used: Set<string>): string {
  for (;;) {
    const female = rand.chance(0.5)
    const first = rand.pick(female ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES)
    const surname = rand.pick(SURNAMES)
    const fullName = `${first} ${female ? `${surname}a` : surname}`
    if (!used.has(fullName)) {
      used.add(fullName)
      return fullName
    }
  }
}

function makePhone(rand: Random): string {
  const n = () => String(rand.int(0, 99)).padStart(2, '0')
  return `+998 ${rand.pick(PHONE_PREFIXES)} ${rand.int(100, 999)} ${n()} ${n()}`
}

function makeEmail(fullName: string): string {
  const [first, last] = fullName.toLowerCase().replace(/'/g, '').split(' ')
  return `${first}.${last}@gmail.com`
}

/**
 * Builds a complete, internally consistent school relative to `now`:
 * students belong to real groups, groups to real teachers, and payments and
 * attendance reference real students. The same date always gives the same data.
 */
export function createDemoData(now: Date = new Date()): SchoolData {
  const rand = createRandom(1729)
  const today = toISODate(now)
  const currentMonth = monthKey(now)
  const billingStart = addMonths(currentMonth, -(HISTORY_MONTHS - 1))
  const usedNames = new Set<string>()

  const teachers = TEACHERS.map((t) => ({ ...t }))
  const groups: Group[] = GROUPS.map(({ fill: _fill, status, ...g }) => ({
    ...g,
    durationMinutes: 90,
    status: status ?? 'active',
  }))

  // ---- Students ----
  const generated: GeneratedStudent[] = []
  let studentNumber = 0

  const enrollmentDate = (): ISODate => {
    const roll = rand.next()
    if (roll < 0.08) return toISODate(addDays(now, -rand.int(0, now.getDate() - 1)))
    if (roll < 0.4) return toISODate(addDays(now, -rand.int(30, 150)))
    return toISODate(addDays(now, -rand.int(160, 620)))
  }

  const addStudent = (groupId: string | null, fee: number, status: StudentStatus) => {
    studentNumber += 1
    const fullName = makeName(rand, usedNames)
    const payerRoll = rand.next()
    const payer: PayerProfile = payerRoll < 0.84 ? 'prompt' : payerRoll < 0.95 ? 'late' : 'behind'
    // A sibling or early-payment discount for a few students.
    const tuition = rand.chance(0.08) ? Math.round((fee * 0.9) / 10_000) * 10_000 : fee
    generated.push({
      student: {
        id: `stu_${String(studentNumber).padStart(3, '0')}`,
        fullName,
        phone: makePhone(rand),
        email: rand.chance(0.4) ? makeEmail(fullName) : undefined,
        groupId,
        enrolledOn: enrollmentDate(),
        monthlyTuition: tuition,
        status,
      },
      payer,
      attendance: rand.chance(0.06) ? 'irregular' : 'steady',
      payDay: payer === 'late' ? rand.int(8, 24) : rand.int(1, 9),
    })
  }

  for (const seed of GROUPS) {
    for (let i = 0; i < seed.fill; i++) addStudent(seed.id, seed.monthlyFee, 'active')
  }
  // A few students who paused or left, for realistic filters.
  for (let i = 0; i < 6; i++) {
    const group = rand.pick(groups.filter((g) => g.status === 'active'))
    addStudent(group.id, group.monthlyFee, 'paused')
  }
  for (let i = 0; i < 8; i++) addStudent(null, rand.pick([450_000, 500_000, 650_000]), 'left')

  // ---- Payments ----
  const payments: Payment[] = []
  let paymentNumber = 0
  for (const { student, payer, payDay } of generated) {
    const firstMonth = monthKeyOf(student.enrolledOn) > billingStart ? monthKeyOf(student.enrolledOn) : billingStart
    const lastMonth = student.status === 'active' ? currentMonth : addMonths(currentMonth, -2)
    if (lastMonth < firstMonth) continue

    for (const period of monthRange(firstMonth, lastMonth)) {
      const monthsAgo = monthRange(period, currentMonth).length - 1
      let amount = student.monthlyTuition
      if (payer === 'behind' && monthsAgo <= 1) continue
      if (payer === 'late' && monthsAgo === 1 && rand.chance(0.5)) amount = Math.round(amount / 2 / 10_000) * 10_000

      const enrolledThisPeriod = monthKeyOf(student.enrolledOn) === period
      const day = enrolledThisPeriod
        ? Number(student.enrolledOn.slice(8))
        : Math.min(payDay + rand.int(0, 2), daysInMonth(period))
      const date = `${period}-${String(day).padStart(2, '0')}`
      if (date > today) continue // not paid yet this month

      const method = pickMethod(rand)
      paymentNumber += 1
      payments.push({
        id: `pay_${String(paymentNumber).padStart(4, '0')}`,
        studentId: student.id,
        amount,
        date,
        period,
        method,
        status: monthsAgo === 0 && method === 'transfer' ? 'pending' : 'paid',
        note: amount < student.monthlyTuition ? 'Partial payment' : undefined,
      })
    }
  }

  // ---- Attendance ----
  const attendance: AttendanceRecord[] = []
  const minutesNow = minutesSinceMidnight(now)
  const firstDay = startOfWeek(addDays(now, -7 * 6))
  let skipped = 0
  for (let day = firstDay; toISODate(day) <= today; day = addDays(day, 1)) {
    const date = toISODate(day)
    const daysAgo = Math.round((atTime(today, '12:00').getTime() - atTime(date, '12:00').getTime()) / 86_400_000)
    for (const group of groups) {
      if (!meetsOn(group, date)) continue
      if (date === today && timeToMinutes(group.startTime) > minutesNow) continue
      // Leave a couple of recent sessions unrecorded, as happens in real life.
      if (daysAgo >= 1 && daysAgo <= 5 && skipped < 2 && rand.chance(0.05)) {
        skipped += 1
        continue
      }
      const marks: Record<string, AttendanceMark> = {}
      for (const g of generated) {
        const s = g.student
        if (s.groupId !== group.id || s.status !== 'active' || s.enrolledOn > date) continue
        const roll = rand.next()
        const presentChance = g.attendance === 'steady' ? 0.9 : 0.55
        marks[s.id] = roll < presentChance ? 'present' : roll < presentChance + 0.06 ? 'late' : 'absent'
      }
      if (Object.keys(marks).length === 0) continue
      const savedAt = atTime(date, group.startTime)
      savedAt.setMinutes(savedAt.getMinutes() + 12)
      attendance.push({
        id: `att_${group.id}_${date}`,
        groupId: group.id,
        date,
        marks,
        savedAt: (savedAt > now ? now : savedAt).toISOString(),
      })
    }
  }

  const students = generated.map((g) => g.student)
  return {
    version: DATA_VERSION,
    seededAt: now.toISOString(),
    teachers,
    groups,
    students,
    attendance,
    payments,
    activity: buildSeedActivity(students, groups, payments, attendance, now),
    settings: { ...DEFAULT_SETTINGS },
    readNotificationIds: [],
  }
}

/** Recent activity derived from the most recent generated records. */
function buildSeedActivity(
  students: Student[],
  groups: Group[],
  payments: Payment[],
  attendance: AttendanceRecord[],
  now: Date,
): Activity[] {
  const studentById = new Map(students.map((s) => [s.id, s]))
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const items: Activity[] = []

  const at = (date: ISODate, time: string) => {
    const moment = atTime(date, time)
    return (moment > now ? now : moment).toISOString()
  }

  for (const s of [...students].filter((s) => s.status === 'active').sort((a, b) => b.enrolledOn.localeCompare(a.enrolledOn)).slice(0, 3)) {
    items.push({
      id: `act_enrol_${s.id}`,
      type: 'student_added',
      title: 'Student registered',
      detail: `${s.fullName} joined ${groupById.get(s.groupId ?? '')?.name ?? 'the centre'}`,
      at: at(s.enrolledOn, '10:20'),
    })
  }
  const latestPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5)
  latestPayments.forEach((p, index) => {
    items.push({
      id: `act_pay_${p.id}`,
      type: 'payment_recorded',
      title: 'Tuition payment recorded',
      detail: `${studentById.get(p.studentId)?.fullName ?? 'A student'} paid UZS ${p.amount.toLocaleString('en-US')}`,
      at: at(p.date, `${16 - index}:${10 + index * 7}`), // spread payments across the afternoon
    })
  })
  for (const r of [...attendance].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 4)) {
    const marks = Object.values(r.marks)
    const present = marks.filter((m) => m !== 'absent').length
    items.push({
      id: `act_att_${r.id}`,
      type: 'attendance_saved',
      title: 'Attendance submitted',
      detail: `${groupById.get(r.groupId)?.name ?? 'A group'}: ${present} of ${marks.length} present`,
      at: r.savedAt,
    })
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12)
}

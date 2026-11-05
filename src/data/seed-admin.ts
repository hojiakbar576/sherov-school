// Sample administration data: courses, rooms, each student's group history
// and timeline, admissions leads with trial lessons, and group assessments.
// Used by the demo generator (seed.ts) and by the upgrade of older saved
// data (migrate.ts). Everything is derived from record ids and dates, so the
// same demo day always produces the same records.

import type {
  Assessment,
  AssessmentResult,
  Course,
  Enrollment,
  Group,
  Lead,
  LeadStage,
  Payment,
  Room,
  SchoolData,
  Student,
  StudentEvent,
  Teacher,
} from '../types'
import { SUBJECTS } from '../types'
import { addDays, atTime, isoWeekday, parseISODate, toISODate } from '../lib/dates'
import { meetsOn } from '../lib/schedule'
import { FEMALE_FIRST_NAMES, MALE_FIRST_NAMES, SURNAMES } from './names'
import { phone, randomFor } from './seed-learning'

/** Courses the centre offers. Russian and Korean are new: no groups yet, but leads ask for them. */
export function seedCourses(): Course[] {
  return [...SUBJECTS, 'Russian', 'Korean'].map((name) => ({ id: `crs_${name.toLowerCase().replace(/[^a-z]+/g, '_')}`, name, active: true, levels: [] }))
}

/** Every room a group uses, plus a spare room at each branch. */
export function seedRooms(groups: Group[], branchIds: string[]): Room[] {
  const rooms = new Map<string, Room>()
  for (const g of groups) {
    const key = `${g.branchId}|${g.room}`
    if (!rooms.has(key)) {
      rooms.set(key, { id: `room_${g.branchId.replace('br_', '')}_${g.room.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, branchId: g.branchId, name: g.room, capacity: g.room === 'Computer Lab' ? 12 : 18 })
    }
  }
  for (const branchId of branchIds) {
    const key = `${branchId}|Room 105`
    if (!rooms.has(key)) rooms.set(key, { id: `room_${branchId.replace('br_', '')}_room_105`, branchId, name: 'Room 105', capacity: 10 })
  }
  return [...rooms.values()].sort((a, b) => a.branchId.localeCompare(b.branchId) || a.name.localeCompare(b.name))
}

const DISCOUNT_REASONS = ['Sibling discount (two children at the centre)', 'Paid three months in advance', 'Returning student discount']
const LEAVE_REASONS = ['Moved to another district', 'Schedule clashes with school', 'Finished the level they needed', 'Family reasons']
const PAUSE_REASONS = ['School exam period', 'Travelling with family', 'Health reasons']

/** Records added later by the office seed (seed-office.ts). */
export type OfficeKeys = 'catalogs' | 'extraLessons' | 'expenses' | 'salaryPayments' | 'staffAttendance' | 'contactLogs' | 'leadStages'
type BaseData = Omit<SchoolData, 'courses' | 'rooms' | 'enrollments' | 'studentEvents' | 'leads' | 'assessments' | 'bonuses' | OfficeKeys> & {
  bonuses?: SchoolData['bonuses']
}

/**
 * Adds the administration records to data that doesn't have them yet.
 * `demo` also adds sample history (graduates, earlier transfers) that only
 * makes sense for freshly generated data, never for someone's saved records.
 */
export function addAdministrationData(base: BaseData, now: Date, { demo }: { demo: boolean }): Omit<SchoolData, OfficeKeys> {
  const today = toISODate(now)
  const groupById = new Map(base.groups.map((g) => [g.id, g]))
  const adminFor = (branchId: string) => base.users.find((u) => u.role === 'admin' && u.branchId === branchId)?.id
  const at = (date: string, time = '10:00') => {
    const moment = atTime(date, time)
    return (moment > now ? now : moment).toISOString()
  }

  let students: Student[] = base.students.map((s) => ({ ...s }))
  const enrollments: Enrollment[] = []
  const events: StudentEvent[] = []
  const event = (s: Student, type: StudentEvent['type'], on: string, title: string, detail?: string) =>
    events.push({ id: `evt_${s.id}_${type}_${on}`, studentId: s.id, type, on, title, ...(detail ? { detail } : {}), at: at(on), byUserId: adminFor(s.branchId) })

  // Demo only: a few students who left actually finished a course, at the branch that ran it.
  const finished = base.groups.find((g) => g.status === 'completed')
  if (demo && finished) {
    const leavers = students.filter((s) => s.status === 'left').slice(0, 3)
    students = students.map((s) => (leavers.includes(s) ? { ...s, status: 'graduated' as const, branchId: finished.branchId } : s))
  }

  for (const s of students) {
    const rand = randomFor(s.id, 'admin')
    const group = groupById.get(s.groupId ?? '')

    // Why someone pays less than their group's fee (sample discounts).
    if (group && s.monthlyTuition < group.monthlyFee && !s.tuitionAdjustment) {
      s.tuitionAdjustment = { kind: 'discount', reason: rand.pick(DISCOUNT_REASONS) }
      event(s, 'tuition_changed', s.enrolledOn, 'Discount agreed', `${s.tuitionAdjustment.reason}. Pays ${s.monthlyTuition.toLocaleString('en-US')} instead of ${group.monthlyFee.toLocaleString('en-US')} UZS.`)
    }

    if (group) {
      // Demo only: some students started in a different group and were moved.
      const earlier = demo && s.status === 'active' && rand.chance(0.06)
        ? base.groups.find((g) => g.id !== group.id && g.branchId === group.branchId && g.subject === group.subject && g.status === 'active')
        : undefined
      const moveOn = toISODate(addDays(parseISODate(s.enrolledOn), rand.int(30, 90)))
      const moved = Boolean(earlier) && moveOn < today
      event(s, 'enrolled', s.enrolledOn, 'Enrolled', `Joined ${moved ? earlier!.name : group.name}`)
      if (earlier && moved) {
        const reason = rand.pick(['Level went up after the monthly test', 'Asked for a different time', 'Better fit for their level'])
        enrollments.push({ id: `enr_${s.id}_1`, studentId: s.id, groupId: earlier.id, branchId: earlier.branchId, startedOn: s.enrolledOn, endedOn: moveOn, endReason: `Transferred to ${group.name}: ${reason}` })
        enrollments.push({ id: `enr_${s.id}_2`, studentId: s.id, groupId: group.id, branchId: group.branchId, startedOn: moveOn })
        event(s, 'transferred', moveOn, `Moved from ${earlier.name} to ${group.name}`, reason)
      } else {
        enrollments.push({ id: `enr_${s.id}_1`, studentId: s.id, groupId: group.id, branchId: group.branchId, startedOn: s.enrolledOn })
      }
      if (s.status === 'paused') {
        const on = toISODate(addDays(now, -rand.int(5, 25)))
        event(s, 'status_changed', on, 'Paused', rand.pick(PAUSE_REASONS))
      }
    } else {
      event(s, 'enrolled', s.enrolledOn, 'Enrolled', s.status === 'graduated' && finished ? `Joined ${finished.name}` : undefined)
    }
    if (!group && s.status === 'graduated' && finished) {
      const ended = toISODate(addDays(now, -rand.int(40, 70)))
      enrollments.push({ id: `enr_${s.id}_1`, studentId: s.id, groupId: finished.id, branchId: finished.branchId, startedOn: s.enrolledOn < ended ? s.enrolledOn : toISODate(addDays(parseISODate(ended), -90)), endedOn: ended, endReason: `Completed ${finished.name}` })
      event(s, 'status_changed', ended, 'Graduated', `Completed ${finished.name}`)
    } else if (!group && s.status === 'left') {
      const on = toISODate(addDays(now, -rand.int(35, 70)))
      event(s, 'status_changed', on < s.enrolledOn ? s.enrolledOn : on, 'Left the centre', rand.pick(LEAVE_REASONS))
    }
  }

  // Who recorded each payment: the branch administrator, for sample data.
  const studentBranch = new Map(students.map((s) => [s.id, s.branchId]))
  const payments: Payment[] = base.payments.map((p) => (p.recordedBy ? p : { ...p, recordedBy: adminFor(studentBranch.get(p.studentId) ?? '') }))

  const teachers: Teacher[] = base.teachers.map((t) => (t.branchHistory ? t : { ...t, branchHistory: [{ branchId: t.branchId, from: t.joinedOn }] }))

  return {
    ...base,
    teachers,
    students,
    payments,
    courses: seedCourses(),
    rooms: seedRooms(base.groups, base.branches.map((b) => b.id)),
    enrollments,
    studentEvents: events.sort((a, b) => a.on.localeCompare(b.on)),
    leads: seedLeads(base.groups, students, base.branches.map((b) => b.id), now),
    assessments: seedAssessments(base.groups, students, now),
    bonuses: base.bonuses ?? [],
  }
}

// ---------------------------------------------------------------- leads

const SOURCES = ['Instagram', 'Telegram channel', 'Friend’s recommendation', 'Walk-in', 'Google Maps', 'School flyer']
const LOST_REASONS = ['Price too high', 'Chose another centre', 'Schedule doesn’t fit', 'Not answering calls']
const LEVELS: Record<string, string[]> = {
  English: ['Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate'],
  'IELTS Preparation': ['Band 4.5', 'Band 5.0', 'Band 5.5', 'Band 6.0'],
  Mathematics: ['Grade 7 level', 'Grade 9 level', 'Admission level'],
  'Computer Science': ['No experience', 'Basic', 'Some programming'],
  Russian: ['Beginner', 'Elementary'],
  Korean: ['Beginner'],
}

/** The next working day (Mon–Sat) on or after this date. */
function workday(date: Date): Date {
  return isoWeekday(date) === 7 ? addDays(date, 1) : date
}

/**
 * About a dozen leads per branch at every stage of the pipeline, including
 * trial lessons today and in the next few days.
 */
export function seedLeads(groups: Group[], students: Student[], branchIds: string[], now: Date): Lead[] {
  const leads: Lead[] = []
  // Stage of each sample lead, newest pipeline stages first.
  const plan: LeadStage[] = ['new', 'new', 'new', 'contacted', 'contacted', 'trial_scheduled', 'trial_scheduled', 'trial_scheduled', 'trial_done', 'trial_done', 'enrolled', 'lost', 'lost']
  for (const branchId of branchIds) {
    const branchGroups = groups.filter((g) => g.branchId === branchId && g.status === 'active')
    const recent = students.filter((s) => s.branchId === branchId && s.status === 'active').sort((a, b) => b.enrolledOn.localeCompare(a.enrolledOn))
    plan.forEach((stage, i) => {
      const id = `lead_${branchId.replace('br_', '')}_${String(i + 1).padStart(2, '0')}`
      const rand = randomFor(id)
      const female = rand.chance(0.5)
      const surname = rand.pick(SURNAMES)
      const studentName = `${rand.pick(female ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES)} ${female ? `${surname}a` : surname}`
      const parentName = `${rand.pick(FEMALE_FIRST_NAMES)} ${surname}a`
      const wantsNew = i === 1 && branchId === 'br_chilonzor'
      const group = rand.pick(branchGroups)
      const course = wantsNew ? 'Korean' : i === 2 ? 'Russian' : group.subject
      const daysAgo = stage === 'new' ? rand.int(0, 2) : stage === 'contacted' ? rand.int(2, 5) : stage === 'trial_scheduled' ? rand.int(3, 8) : rand.int(8, 25)
      const created = addDays(now, -daysAgo)
      const lead: Lead = {
        id,
        branchId,
        studentName,
        ...(rand.chance(0.8) ? { parentName } : {}),
        phone: phone(rand),
        course,
        stage,
        source: rand.pick(SOURCES),
        ...(rand.chance(0.6) ? { notes: rand.pick(['Wants evening classes', 'Asked about the price for two children', 'Prefers a female teacher', 'Preparing for school entrance exams', 'Called twice, very interested']) } : {}),
        createdAt: atTime(toISODate(created), `${rand.int(10, 18)}:${String(rand.int(0, 59)).padStart(2, '0')}`).toISOString(),
        updatedAt: now.toISOString(),
      }
      const groupFor = branchGroups.filter((g) => g.subject === course)
      const trialGroup = groupFor.length ? rand.pick(groupFor) : undefined

      if (stage === 'trial_scheduled') {
        // One trial today (or the next working day), the rest in the next few days.
        const day = workday(addDays(now, i === 5 ? 0 : i - 5))
        lead.trial = { date: toISODate(day), time: trialGroup?.startTime ?? '15:30', groupId: trialGroup?.id, teacherId: trialGroup?.teacherId, attended: null }
      }
      if (stage === 'trial_done' || stage === 'enrolled' || (stage === 'lost' && i === 12)) {
        const day = workday(addDays(now, -rand.int(3, 9)))
        const attended = stage !== 'lost'
        lead.trial = {
          date: toISODate(day),
          time: trialGroup?.startTime ?? '15:30',
          groupId: trialGroup?.id,
          teacherId: trialGroup?.teacherId,
          attended,
          outcome: attended ? rand.pick(['Engaged and keen to join', 'Did well, slightly above the group level', 'Quiet but followed the lesson']) : 'Did not come',
        }
        if (attended) {
          lead.placement = {
            level: rand.pick(LEVELS[course] ?? ['Beginner']),
            score: `${rand.int(18, 46)}/50`,
            recommendedGroupId: trialGroup?.id,
            notes: rand.pick(['Strong reading, needs speaking practice', 'Good basics', 'Needs to review the fundamentals first']),
            on: toISODate(day),
          }
        }
      }
      if (stage === 'enrolled' && recent[0]) {
        // Link to a real student who joined recently.
        const s = recent[0]
        Object.assign(lead, { studentName: s.fullName, studentId: s.id, course: groups.find((g) => g.id === s.groupId)?.subject ?? lead.course })
      }
      if (stage === 'lost') lead.lostReason = rand.pick(LOST_REASONS)
      leads.push(lead)
    })
  }
  return leads
}

// ---------------------------------------------------------------- assessments

/**
 * A monthly test for every running group last month, a level test for some,
 * and a midterm planned next week for a few (no results yet).
 */
export function seedAssessments(groups: Group[], students: Student[], now: Date): Assessment[] {
  const items: Assessment[] = []
  const today = toISODate(now)
  const resultsFor = (assessmentId: string, group: Group, date: string, max: number): AssessmentResult[] =>
    students
      .filter((s) => s.groupId === group.id && s.status !== 'left' && s.enrolledOn <= date)
      .map((s) => {
        const habit = randomFor(s.id, 'habit')
        habit.next()
        const level = 0.52 + habit.next() * 0.44 // the same steady level as their homework
        const rand = randomFor(assessmentId, s.id)
        if (rand.chance(0.06)) return { studentId: s.id, score: null, comment: 'Absent on the day' }
        const score = Math.max(0, Math.min(max, Math.round(max * (level + (rand.next() - 0.5) * 0.18))))
        return { studentId: s.id, score, ...(rand.chance(0.25) ? { comment: score / max >= 0.85 ? 'Excellent result' : score / max < 0.6 ? 'Needs extra practice' : 'Solid work' } : {}) }
      })

  groups
    .filter((g) => g.status === 'active')
    .forEach((g, index) => {
      // The last lesson day about three weeks ago.
      let date = addDays(now, -21 - (index % 4))
      for (let k = 0; k < 7 && !meetsOn(g, toISODate(date)); k++) date = addDays(date, -1)
      const monthlyId = `asm_${g.id}_monthly`
      items.push({
        id: monthlyId,
        groupId: g.id,
        title: 'Monthly test',
        kind: 'monthly',
        date: toISODate(date),
        maxScore: 100,
        results: resultsFor(monthlyId, g, toISODate(date), 100),
        createdBy: `usr_${g.teacherId}`,
        createdAt: atTime(toISODate(date), '20:00').toISOString(),
      })
      if (index % 3 === 0) {
        const levelDate = toISODate(addDays(date, -28))
        const levelId = `asm_${g.id}_level`
        items.push({
          id: levelId,
          groupId: g.id,
          title: 'Level check',
          kind: 'level',
          date: levelDate,
          maxScore: 50,
          results: resultsFor(levelId, g, levelDate, 50),
          createdBy: `usr_${g.teacherId}`,
          createdAt: atTime(levelDate, '20:00').toISOString(),
        })
      }
      if (index % 4 === 1) {
        let next = addDays(now, 7)
        for (let k = 0; k < 7 && !meetsOn(g, toISODate(next)); k++) next = addDays(next, 1)
        if (toISODate(next) > today) {
          items.push({ id: `asm_${g.id}_midterm`, groupId: g.id, title: 'Midterm', kind: 'midterm', date: toISODate(next), maxScore: 100, results: [], createdBy: `usr_${g.teacherId}`, createdAt: now.toISOString() })
        }
      }
    })
  return items
}

// Sample learning data: student profiles and parents, homework with each
// student's result, and teacher notes. Everything here is derived from
// record ids, so the demo generator and the upgrade of older saved data
// (migrate.ts) produce exactly the same details for the same student.

import type {
  AttendanceRecord,
  Gender,
  Grade,
  Group,
  Guardian,
  Homework,
  HomeworkResult,
  ISODate,
  Student,
  StudentNote,
  Subject,
  Teacher,
} from '../types'
import { addDays, atTime, parseISODate, toISODate } from '../lib/dates'
import { createRandom, type Random } from '../lib/random'
import { FEMALE_FIRST_NAMES, MALE_FIRST_NAMES, PHONE_PREFIXES } from './names'

/** A stable random sequence for one record, e.g. randomFor('stu_014', 'parents'). */
export function randomFor(...keys: string[]): Random {
  let hash = 2166136261
  for (const ch of keys.join('|')) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619)
  return createRandom(hash >>> 0)
}

export const phone = (rand: Random) => {
  const n = () => String(rand.int(0, 99)).padStart(2, '0')
  return `+998 ${rand.pick(PHONE_PREFIXES)} ${rand.int(100, 999)} ${n()} ${n()}`
}

// ---------------------------------------------------------------- profiles

/** Typical ages per group; anything else is a teenager. */
const AGE_RANGE: Record<string, [number, number]> = {
  grp_05: [8, 10], // Kids English Starters
  grp_18: [9, 11], // Scratch for Kids
  grp_17: [11, 14], // Computer Literacy
  grp_11: [13, 14], // Mathematics Grade 7–8
  grp_14: [15, 17], // Mathematics Grade 9–11
  grp_12: [16, 17], // University Admission Math
  grp_13: [16, 18], // SAT Math
  grp_19: [22, 38], // English for Adults
  grp_07: [16, 22],
  grp_08: [17, 24],
  grp_09: [16, 25],
  grp_10: [17, 26],
  grp_20: [16, 22],
}

const STREETS: Record<string, string[]> = {
  br_chilonzor: ['Chilonzor 9th block', 'Chilonzor 19th block', 'Bunyodkor Avenue', 'Muqimiy Street', 'Qatortol Street'],
  br_bashlik: ['Bashlik Street', 'Mukimi Street', 'Uchtepa 22nd block', 'Farhod Street', 'Lutfiy Street'],
  br_quyliq: ['Quyliq 4th block', 'Quyliq 5th block', 'Ahmad Donish Street', 'Sergeli 7th block', 'Yangi Sergeli Street'],
}

/** Personal details and parents, worked out from the student's id and group. */
export function studentProfile(student: Pick<Student, 'id' | 'fullName' | 'groupId' | 'branchId' | 'enrolledOn'>, now: Date) {
  const rand = randomFor(student.id, 'profile')
  const [first, surname = ''] = student.fullName.split(' ')
  const gender: Gender = (FEMALE_FIRST_NAMES as readonly string[]).includes(first) ? 'female' : 'male'
  const familyName = gender === 'female' && surname.endsWith('a') ? surname.slice(0, -1) : surname

  const [minAge, maxAge] = AGE_RANGE[student.groupId ?? ''] ?? [14, 17]
  const age = rand.int(minAge, maxAge)
  const birth = new Date(now.getFullYear() - age, rand.int(0, 11), rand.int(1, 28))
  const adult = age >= 18

  const address = rand.chance(0.8)
    ? `${rand.pick(STREETS[student.branchId] ?? STREETS.br_chilonzor)}, house ${rand.int(1, 60)}${rand.chance(0.6) ? `, apt ${rand.int(1, 90)}` : ''}, Tashkent`
    : undefined

  const guardians: Guardian[] = []
  const mother = () => ({
    id: `${student.id}_g${guardians.length + 1}`,
    fullName: `${rand.pick(FEMALE_FIRST_NAMES)} ${familyName}a`,
    relationship: 'mother' as const,
    phone: phone(rand),
    ...(rand.chance(0.25) ? { altPhone: phone(rand) } : {}),
  })
  const father = () => ({
    id: `${student.id}_g${guardians.length + 1}`,
    fullName: `${rand.pick(MALE_FIRST_NAMES)} ${familyName}`,
    relationship: 'father' as const,
    phone: phone(rand),
    ...(rand.chance(0.35) ? { altPhone: phone(rand) } : {}),
  })
  const roll = rand.next()
  if (adult) {
    // Adults are their own contact; some still list a parent.
    if (rand.chance(0.3)) guardians.push(mother())
  } else if (roll < 0.55) {
    guardians.push(mother())
    guardians.push(father())
  } else if (roll < 0.8) {
    guardians.push(mother())
  } else if (roll < 0.94) {
    guardians.push(father())
  } else {
    guardians.push({
      id: `${student.id}_g1`,
      fullName: `${rand.pick(FEMALE_FIRST_NAMES)} ${familyName}a`,
      relationship: 'grandmother',
      phone: phone(rand),
    })
  }

  return { dateOfBirth: toISODate(birth), gender, address, guardians }
}

// ---------------------------------------------------------------- homework

const HOMEWORK_IDEAS: Record<Subject, [string, string][]> = {
  English: [
    ['Unit 7 vocabulary', 'Learn the 20 new words from Unit 7 and write one sentence with each.'],
    ['Past Simple or Present Perfect', 'Complete the worksheet handed out in class (exercises A–D).'],
    ['Reading: “The Lost Key”', 'Read the story on pages 54–55 and answer questions 1–8 in your notebook.'],
    ['Email to a friend', 'Write a 120-word email inviting a friend to your birthday. Use at least three future forms.'],
    ['Listening: daily routines', 'Listen to track 14 twice and fill in the gaps on the handout.'],
    ['Describe your neighbourhood', 'Write 8–10 sentences about where you live. Use there is / there are.'],
  ],
  'IELTS Preparation': [
    ['Writing Task 2: opinion essay', 'Write 250+ words on: “Should university education be free?” Plan for 5 minutes first.'],
    ['Reading test 4, passages 1–2', 'Complete under exam timing (40 minutes) and mark difficult questions.'],
    ['Listening section 3', 'Do the practice test, then check your answers against the transcript.'],
    ['Speaking part 2 cue cards', 'Record yourself answering three cue cards, 2 minutes each.'],
    ['Writing Task 1: line graph', 'Describe the graph on page 31 in 150+ words. Include an overview.'],
    ['Collocations set 5', 'Learn the 30 collocations and use ten of them in your own sentences.'],
  ],
  Mathematics: [
    ['Quadratic equations', 'Exercises 4.12 to 4.30. Show every step.'],
    ['Similar triangles worksheet', 'Problems 1–12 from the geometry sheet. Draw a diagram for each.'],
    ['Admission test, variant 3', 'Solve the full variant in 90 minutes and note the time you spent per section.'],
    ['Fractions and percentages', 'Review sheet, both sides. Bring questions to the next class.'],
    ['Systems of equations', 'Problems 6.1 to 6.15 using both substitution and elimination.'],
    ['Word problems: speed and work', 'Solve problems 1–10 from the handout. Write units in every answer.'],
  ],
  'Computer Science': [
    ['Loops, exercise set 3', 'Solve tasks 1–6 in Python and save each as a separate file.'],
    ['Personal web page', 'Build a one-page site about yourself using HTML and CSS from the last two lessons.'],
    ['Animate your name', 'In Scratch, make each letter of your name move or change colour when clicked.'],
    ['Typing practice', 'Practise for 15 minutes a day and write down your speed each day.'],
    ['Lists and dictionaries', 'Write a program that counts how often each word appears in a sentence.'],
    ['Spreadsheet budget', 'Make a monthly budget in a spreadsheet with totals and one chart.'],
  ],
}

const RESOURCES: Record<Subject, string[]> = {
  English: ['Student’s Book, Unit 7', 'Workbook pp. 40–42', 'Handout from class'],
  'IELTS Preparation': ['Cambridge IELTS 17, Test 2', 'Writing checklist (shared in Telegram group)', 'ielts.org sample answers'],
  Mathematics: ['Textbook §4.2', 'Admission test booklet, variant 3', 'Handout from class'],
  'Computer Science': ['python.org tutorial, section 4', 'scratch.mit.edu', 'Class repository on GitHub'],
}

/** Weeks of homework history per running group, plus one assignment currently due. */
export const HOMEWORK_WEEKS = 5

/** Students a homework is for: everyone in the group (not those who left) when it was set. */
export function homeworkStudents(students: Student[], groupId: string, assignedOn: ISODate): string[] {
  return students
    .filter((s) => s.groupId === groupId && s.status !== 'left' && s.enrolledOn <= assignedOn)
    .map((s) => s.id)
}

export function seedHomework(groups: Group[], students: Student[], now: Date): Homework[] {
  const items: Homework[] = []
  groups
    .filter((g) => g.status === 'active')
    .forEach((g, index) => {
      const ideas = HOMEWORK_IDEAS[g.subject]
      const rand = randomFor(g.id, 'homework')
      // Oldest first: week 5 ago … last week, then the one due this week.
      for (let week = HOMEWORK_WEEKS; week >= 0; week--) {
        const assigned = addDays(now, -(7 * week) - 2 - (index % 2))
        const due = week === 0 ? addDays(now, 1 + (index % 5)) : addDays(assigned, 5)
        const [title, description] = ideas[(index + HOMEWORK_WEEKS - week) % ideas.length]
        const assignedOn = toISODate(assigned)
        items.push({
          id: `hw_${g.id}_${HOMEWORK_WEEKS - week + 1}`,
          groupId: g.id,
          teacherId: g.teacherId,
          title,
          description,
          ...(rand.chance(0.5) ? { resource: rand.pick(RESOURCES[g.subject]) } : {}),
          assignedOn,
          dueDate: toISODate(due),
          studentIds: homeworkStudents(students, g.id, assignedOn),
          createdAt: atTime(assignedOn, '19:30').toISOString(),
        })
      }
    })
  return items
}

const FEEDBACK: [number, string[]][] = [
  [90, ['Excellent work, accurate and well organised.', 'Very strong. Keep this level.', 'Great answers and clear explanations.', 'Almost perfect. Watch small details.']],
  [75, ['Good work. Review the mistakes I marked.', 'Solid effort. Check exercise 3 again.', 'Good, but add more detail to your answers.', 'Mostly correct. Be careful with timing.']],
  [60, ['Fair attempt. Several mistakes to correct before next class.', 'Needs more practice on the new topic.', 'Incomplete in places. Redo the last section.', 'Check the rules again and correct the marked parts.']],
  [0, ['Many mistakes. Let’s go through it together after class.', 'Too little was done. Please redo it.', 'Needs serious revision. Ask me for extra exercises.']],
]

function feedbackFor(score: number, rand: Random): string {
  return rand.pick(FEEDBACK.find(([min]) => score >= min)![1])
}

/**
 * Results for seeded homework. Each student has a steady habit (how often
 * they hand work in, their usual level, whether they're improving) so their
 * history reads like a real pupil's.
 */
export function seedHomeworkResults(homework: Homework[], now: Date): HomeworkResult[] {
  const today = toISODate(now)
  const results: HomeworkResult[] = []
  // Most recent past-due homework per group: some results still wait for marking.
  const latestPast = new Map<string, string>()
  for (const h of [...homework].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    if (h.dueDate < today) latestPast.set(h.groupId, h.id)
  }
  const weekOf = (h: Homework) => Math.round((parseISODate(today).getTime() - parseISODate(h.assignedOn).getTime()) / (7 * 86_400_000))

  for (const h of homework) {
    for (const studentId of h.studentIds) {
      const habit = randomFor(studentId, 'habit')
      const diligence = 0.62 + habit.next() * 0.36
      const level = 52 + habit.next() * 44
      const trend = habit.next() * 4 - 2 // points per week, older work further from today's level
      const rand = randomFor(h.id, studentId)
      const roll = rand.next()
      const updatedAt = atTime(h.dueDate, '18:00')

      if (h.dueDate >= today) {
        // Due soon: a few students have already handed it in.
        if (roll < 0.3) {
          const on = toISODate(addDays(parseISODate(h.assignedOn), rand.int(1, 2)))
          if (on <= today) results.push({ id: `res_${h.id}_${studentId}`, homeworkId: h.id, studentId, submission: 'submitted', submittedOn: on, updatedAt: atTime(on, '17:20').toISOString() })
        }
        continue
      }

      const submission = roll < diligence * 0.9 ? 'submitted' : roll < diligence ? 'late' : 'not_submitted'
      if (submission === 'not_submitted') continue
      const submittedOn = toISODate(submission === 'late' ? addDays(parseISODate(h.dueDate), rand.int(1, 3)) : addDays(parseISODate(h.dueDate), -rand.int(0, 2)))
      const markedYet = h.id !== latestPast.get(h.groupId) || rand.chance(0.55)
      const score = Math.max(25, Math.min(100, Math.round(level - trend * weekOf(h) + rand.int(-9, 8) - (submission === 'late' ? 5 : 0))))
      const evaluatedAt = atTime(toISODate(addDays(parseISODate(submittedOn > h.dueDate ? submittedOn : h.dueDate), 1)), `${rand.int(19, 21)}:${String(rand.int(0, 59)).padStart(2, '0')}`)
      results.push({
        id: `res_${h.id}_${studentId}`,
        homeworkId: h.id,
        studentId,
        submission,
        submittedOn,
        ...(markedYet && evaluatedAt <= now
          ? { evaluation: { score, feedback: feedbackFor(score, rand), evaluatedAt: evaluatedAt.toISOString(), evaluatedBy: `usr_${h.teacherId}` } }
          : {}),
        updatedAt: (markedYet && evaluatedAt <= now ? evaluatedAt : updatedAt > now ? now : updatedAt).toISOString(),
      })
    }
  }
  return results
}

// ---------------------------------------------------------------- notes

const NOTES: [string, boolean][] = [
  ['Shy when speaking in pairs. Give her or him short speaking roles first.', false],
  ['Preparing for an exam in March. Target set with the family.', false],
  ['Parent asked for a call after the mid-term results.', false],
  ['Sits near the board: has trouble seeing from the back row.', true],
  ['Leaves 15 minutes early on Fridays for football training (agreed with parents).', true],
  ['Strong at grammar, needs more reading practice at home.', false],
  ['Missed two weeks in September (family trip). Caught up on most topics.', false],
  ['Allergic to nuts. Don’t hand out snacks without checking.', true],
]

export function seedStudentNotes(students: Student[], groups: Group[], teachers: Teacher[], now: Date): StudentNote[] {
  const groupTeacher = new Map(groups.map((g) => [g.id, teachers.find((t) => t.id === g.teacherId)]))
  const notes: StudentNote[] = []
  for (const s of students) {
    const teacher = groupTeacher.get(s.groupId ?? '')
    if (!teacher || s.status === 'left') continue
    const rand = randomFor(s.id, 'notes')
    if (!rand.chance(0.14)) continue
    const [text, important] = rand.pick(NOTES)
    notes.push({
      id: `note_${s.id}`,
      studentId: s.id,
      authorId: `usr_${teacher.id}`,
      authorName: teacher.fullName,
      text: text.replace('her or him', s.fullName.split(' ')[0]),
      important,
      createdAt: atTime(toISODate(addDays(now, -rand.int(3, 40))), '20:15').toISOString(),
    })
  }
  return notes
}

// ---------------------------------------------------------------- lesson grades and pay

/** Each demo teacher's share of their students' tuition, in percent. */
export const SALARY_PERCENT: Record<string, number> = {
  tch_01: 40, tch_02: 45, tch_03: 50, tch_04: 40, tch_05: 35,
  tch_06: 40, tch_07: 45, tch_08: 30, tch_09: 35, tch_10: 40,
}
export const DEFAULT_SALARY_PERCENT = 40

/**
 * Sample 1–5 grades for saved lessons. Teachers differ in how often they
 * grade, and students in their usual level, so ratings differ realistically.
 * Records that already have grades are left as they are.
 */
export function withSampleGrades(records: AttendanceRecord[]): AttendanceRecord[] {
  return records.map((r) => {
    if (r.grades) return r
    const habit = randomFor(r.teacherId, 'grading')
    const gradingRate = 0.3 + habit.next() * 0.6
    const rand = randomFor(r.id, 'grades')
    const grades: Record<string, Grade> = {}
    for (const [studentId, mark] of Object.entries(r.marks)) {
      if (mark === 'absent' || !rand.chance(gradingRate)) continue
      const level = 2.6 + randomFor(studentId, 'level').next() * 2.4 // 2.6–5.0
      grades[studentId] = Math.max(1, Math.min(5, Math.round(level + (rand.next() - 0.5) * 1.6))) as Grade
    }
    return Object.keys(grades).length ? { ...r, grades } : r
  })
}

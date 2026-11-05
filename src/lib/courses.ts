// Academic structure: Course (program) → Level → Group.
//
// Every learning centre names its own courses and levels (they are data, in
// Settings, never hard-coded). A group's own name is just a label ("INT-01",
// "IELTS Evening A"); what it teaches comes from `courseId` and `levelId`.
// `group.subject` and `group.level` are kept as copies of the course and level
// names so older screens and exports keep working; `withGroupLabels` keeps
// them in step whenever a course or level is renamed.

import type { Course, CourseLevel, Group, SchoolData } from '../types'

/** A stable id for a level, unique within the whole school. */
export function levelId(courseId: string, name: string, taken: ReadonlySet<string> = new Set()): string {
  const base = `lvl_${courseId.replace(/^crs_/, '')}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'level'}`
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

/** The level a group is in, or undefined. */
export function levelOf(courses: readonly Course[], group: Pick<Group, 'courseId' | 'levelId'>): { course?: Course; level?: CourseLevel } {
  const course = courses.find((c) => c.id === group.courseId)
  return { course, level: course?.levels.find((l) => l.id === group.levelId) }
}

/** "General English → Intermediate → INT-01". */
export function groupPath(courses: readonly Course[], group: Group): string {
  const { course, level } = levelOf(courses, group)
  return [course?.name ?? group.subject, level?.name ?? group.level, group.name].filter(Boolean).join(' → ')
}

/** Copies the current course and level names onto every group. */
export function withGroupLabels(groups: readonly Group[], courses: readonly Course[]): Group[] {
  return groups.map((g) => {
    const { course, level } = levelOf(courses, g)
    const subject = course?.name ?? g.subject
    const name = level?.name ?? g.level
    return subject === g.subject && name === g.level ? (g as Group) : { ...g, subject, ...(name ? { level: name } : {}) }
  })
}

/**
 * Puts any saved data into the Course → Level → Group shape. Safe to run more
 * than once. Levels saved as plain names become level records; a group whose
 * course or level isn't on the list gets one, so no group is left unplaced.
 */
export function structureCourses(data: SchoolData): SchoolData {
  const courses: Course[] = (data.courses as (Omit<Course, 'levels'> & { levels?: (string | CourseLevel)[] })[]).map((c) => ({ ...c, levels: [] as CourseLevel[], _raw: c.levels ?? [] }) as Course & { _raw: (string | CourseLevel)[] })
  const taken = new Set<string>()
  for (const c of courses as (Course & { _raw: (string | CourseLevel)[] })[]) {
    for (const l of c._raw) {
      if (typeof l === 'string') {
        if (c.levels.some((x) => x.name.toLowerCase() === l.toLowerCase())) continue
        const id = levelId(c.id, l, taken)
        taken.add(id)
        c.levels.push({ id, name: l, active: true })
      } else {
        taken.add(l.id)
        c.levels.push(l)
      }
    }
    delete (c as { _raw?: unknown })._raw
  }

  const courseFor = (g: Group): Course => {
    let course = courses.find((c) => c.id === g.courseId) ?? courses.find((c) => c.name.toLowerCase() === g.subject.trim().toLowerCase())
    if (!course) {
      const base = `crs_${g.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'course'}`
      let id = base
      for (let n = 2; courses.some((c) => c.id === id); n++) id = `${base}-${n}`
      course = { id, name: g.subject.trim() || 'General', active: true, levels: [] }
      courses.push(course)
    }
    return course
  }

  const groups = data.groups.map((g) => {
    const course = courseFor(g)
    let level = course.levels.find((l) => l.id === g.levelId)
    if (!level) {
      const wanted = (g.level ?? '').trim() || 'General'
      level = course.levels.find((l) => l.name.toLowerCase() === wanted.toLowerCase())
      if (!level) {
        level = { id: levelId(course.id, wanted, taken), name: wanted, active: true }
        taken.add(level.id)
        course.levels.push(level)
      }
    }
    return { ...g, courseId: course.id, levelId: level.id }
  })

  return { ...data, courses, groups: withGroupLabels(groups, courses) }
}

/** What's wrong with a course's new name and levels, or null if it can be saved. */
export function checkCourse(courses: readonly Course[], courseId: string, name: string, levels: readonly CourseLevel[]): string | null {
  const clean = name.trim()
  if (clean.length < 2) return 'Enter the course name.'
  if (courses.some((c) => c.id !== courseId && c.name.trim().toLowerCase() === clean.toLowerCase())) return 'Another course already has this name.'
  const names = levels.map((l) => l.name.trim().toLowerCase())
  if (names.some((n) => !n)) return 'Every level needs a name.'
  if (new Set(names).size !== names.length) return 'Two levels have the same name.'
  return null
}

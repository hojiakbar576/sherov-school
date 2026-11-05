import { useSchool } from '../../data/school-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { tr } from '../../i18n'
import { WeekTimetable } from './WeekTimetable'

export function SchedulePage() {
  const { user } = useSchool()
  const isTeacher = user?.role === 'teacher'

  return (
    <>
      <PageHeader
        title={isTeacher ? tr("My schedule") : tr("Schedule")}
        description={
          isTeacher ? tr("Your classes only. Open a class that has started to take attendance.") : tr("The weekly timetable of running groups. Odd-day groups meet Mon, Wed, Fri; even-day groups meet Tue, Thu, Sat.")
        }
      />
      <WeekTimetable showTeacher={!isTeacher} initialView={isTeacher ? 'day' : 'week'} />
    </>
  )
}

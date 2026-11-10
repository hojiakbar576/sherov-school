import { useSearchParams } from 'react-router'
import { useSchool } from '../../data/school-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { tr } from '../../i18n'
import { WeekTimetable } from './WeekTimetable'

/** The full timetable ("Timetable" in the sidebar). `?view=day` opens it on today, e.g. from the dashboard. */
export function SchedulePage() {
  const { user } = useSchool()
  const isTeacher = user?.role === 'teacher'
  const [params] = useSearchParams()
  const asked = params.get('view')
  const initialView = asked === 'day' || asked === 'week' ? asked : isTeacher ? 'day' : 'week'

  return (
    <>
      <PageHeader
        title={isTeacher ? tr("My schedule") : tr("Timetable")}
        description={
          isTeacher ? tr("Your classes only. Open a class that has started to take attendance.") : tr("The weekly timetable of running groups. Odd-day groups meet Mon, Wed, Fri; even-day groups meet Tue, Thu, Sat.")
        }
      />
      <WeekTimetable key={initialView} showTeacher={!isTeacher} initialView={initialView} />
    </>
  )
}

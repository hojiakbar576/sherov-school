import type { Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { ConfirmDialog } from '../../components/ui/Dialog'

/** Confirms deleting a student and says exactly what else goes with them. */
export function DeleteStudentDialog({ student, onClose, onDeleted }: { student: Student | null; onClose: () => void; onDeleted?: () => void }) {
  const { data, actions } = useSchool()
  const toast = useToast()
  const payments = student ? data.payments.filter((p) => p.studentId === student.id).length : 0
  const marks = student ? data.attendance.filter((r) => student.id in r.marks).length : 0

  return (
    <ConfirmDialog
      open={student !== null}
      title="Delete student?"
      confirmLabel="Delete student"
      onClose={onClose}
      onConfirm={() => {
        if (!student) return
        actions.deleteStudent(student.id)
        toast.show(`${student.fullName} was deleted.`)
        onDeleted?.()
      }}
    >
      <p>
        <strong className="font-medium text-ink">{student?.fullName}</strong> will be removed along with {payments} {payments === 1 ? 'payment' : 'payments'} and{' '}
        {marks} attendance {marks === 1 ? 'mark' : 'marks'}.
      </p>
      <p>If they have simply stopped attending, consider setting their status to “Left” instead, which keeps their history.</p>
    </ConfirmDialog>
  )
}

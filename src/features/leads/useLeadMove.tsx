import { useState, type ReactNode } from 'react'
import type { Lead, LeadStage } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { stageName } from '../../lib/lead-stages'
import { tr } from '../../i18n'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { LostDialog, TrialDialog, TrialResultDialog } from './LeadDialogs'

type Pending = { kind: 'trial' | 'result' | 'lost' | 'enroll'; lead: Lead } | null

/**
 * Moving an enquiry to a stage, the same way everywhere (board, enquiry page).
 * Built-in stages that need details open their form first: a trial needs a
 * date, a trial result needs the result, enrolling needs a group, lost needs a
 * reason. Plain stages (New, Contacted, and any the owner added) move at once.
 * Render `dialogs` once where the hook is used.
 */
export function useLeadMove(): { moveTo: (lead: Lead, stage: LeadStage) => void; openForm: (kind: NonNullable<Pending>['kind'], lead: Lead) => void; dialogs: ReactNode } {
  const { data, actions } = useSchool()
  const toast = useToast()
  const [pending, setPending] = useState<Pending>(null)
  const close = () => setPending(null)

  const moveTo = (lead: Lead, stage: LeadStage) => {
    if (lead.stage === stage) return
    if (lead.stage === 'enrolled') {
      toast.show(tr("{0} is already a student. Change things on their student profile.", lead.studentName), 'error')
      return
    }
    switch (stage) {
      case 'trial_scheduled':
        setPending({ kind: 'trial', lead })
        return
      case 'trial_done':
        if (!lead.trial) {
          toast.show(tr("Book the trial lesson first."), 'error')
          setPending({ kind: 'trial', lead })
        } else setPending({ kind: 'result', lead })
        return
      case 'enrolled':
        setPending({ kind: 'enroll', lead })
        return
      case 'lost':
        setPending({ kind: 'lost', lead })
        return
      default:
        actions.updateLead(lead.id, { stage, lostReason: undefined })
        toast.show(`${lead.studentName}: ${stageName(data.leadStages, stage)}.`)
    }
  }

  const lead = pending?.lead
  const dialogs = (
    <>
      {pending?.kind === 'trial' && lead && <TrialDialog open lead={lead} onClose={close} />}
      {pending?.kind === 'result' && lead && <TrialResultDialog open lead={lead} onClose={close} />}
      {pending?.kind === 'lost' && lead && <LostDialog open lead={lead} onClose={close} />}
      {pending?.kind === 'enroll' && lead && (
        <StudentFormDialog
          open
          onClose={close}
          title={tr("Enroll {0}", lead.studentName)}
          initial={{
            fullName: lead.studentName,
            parentName: lead.parentName,
            parentPhone: lead.phone,
            groupId: lead.placement?.recommendedGroupId ?? lead.trial?.groupId,
          }}
          create={(input) => actions.enrollLead(lead.id, input)}
          onSaved={(s) => {
            close()
            toast.show(tr("{0} is now a student.", s.fullName), 'success')
          }}
        />
      )}
    </>
  )

  return { moveTo, openForm: (kind, l) => setPending({ kind, lead: l }), dialogs }
}

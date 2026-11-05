import { useSchool } from '../data/school-context'
import { tr } from '../i18n'

/**
 * When the owner is looking at all branches, things that belong to one branch
 * (a new teacher, room or enquiry) need a branch chosen first. Returns the
 * message to show, or null when there's a branch to add to.
 */
export function useBranchChoice(): string | null {
  const { owner } = useSchool()
  return owner && !owner.branchId ? tr("Choose a branch at the top of the page first.") : null
}

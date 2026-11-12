import { useLocation } from 'react-router-dom'
import { moduleForPath, userCan, type PrivilegeAction } from '../lib/permissions'
import { useAuthStore } from '../store/authStore'

/** What the signed-in account may do on the current page (pages without a module allow it all). */
export function usePagePermissions() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const module = moduleForPath(pathname)
  const can = (action: PrivilegeAction) => !module || userCan(user, module, action)
  return {
    module,
    can,
    canAdd: can('add'),
    canEdit: can('edit'),
    canDelete: can('delete')
  }
}

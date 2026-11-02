import type { ReactNode } from 'react'
import { usePagePermissions } from '../../hooks/usePagePermissions'
import type { PrivilegeAction } from '../../lib/permissions'

/** Shows its children only when the signed-in account may do `action` in this page's module. */
export function Allowed({ action, children }: { action: PrivilegeAction; children: ReactNode }) {
  const { can } = usePagePermissions()
  return can(action) ? <>{children}</> : null
}

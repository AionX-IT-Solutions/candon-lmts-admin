import { isNavGroup, navEntries } from '../components/layout/navigation'
import type { AuthUser } from '../types'

/**
 * Roles, privileges and the "may this account do it" rule. The database enforces the same rule
 * (private.can in supabase/migrations) and so does the admin-users Edge Function.
 */

/** What an account can do in a module. Add, Edit and Delete need View to reach the module. */
export const PRIVILEGE_ACTIONS = ['view', 'add', 'edit', 'delete'] as const
export type PrivilegeAction = (typeof PRIVILEGE_ACTIONS)[number]

export const ACTION_LABELS: Record<PrivilegeAction, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete'
}

/** Roles that can do everything without privileges. */
export const FULL_ACCESS_ROLES = ['Developer', 'Admin']

export const ROLES = [
  { value: 'Developer', label: 'Developer' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Secretary', label: 'Secretary' },
  { value: 'Staff', label: 'Staff' },
  { value: 'View Only', label: 'View Only' },
  // S.P members sign in to the candon-app mobile app (it checks for this exact value)
  { value: 'S.P MEMBER', label: 'S.P Member' }
]

const NAV_ITEMS = navEntries.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]))

/** Every module in sidebar order, labelled with the pages it covers. */
export const PRIVILEGE_MODULES = [
  ...new Set(NAV_ITEMS.flatMap((item) => (item.privilege ? [item.privilege] : [])))
].map((module) => ({
  module,
  label: NAV_ITEMS.filter((item) => item.privilege === module)
    .map((item) => item.label)
    .join(', '),
  actions: PRIVILEGE_ACTIONS as readonly PrivilegeAction[]
}))

/** How a privilege is stored in users.privileges, e.g. "Ordinances:edit". */
export const privilegeKey = (module: string, action: PrivilegeAction) => `${module}:${action}`

/** Whether the account may do `action` in `module` — same rule as private.can() in the database. */
export function userCan(
  user: Pick<AuthUser, 'role' | 'privileges'> | null,
  module: string,
  action: PrivilegeAction = 'view'
): boolean {
  if (!user) return false
  if (FULL_ACCESS_ROLES.includes(user.role)) return true
  if (user.role === 'Pending') return false
  if (action !== 'view' && user.role === 'View Only') return false
  // A bare module name (saved by older builds) means every action
  return user.privileges.includes(privilegeKey(module, action)) || user.privileges.includes(module)
}

/** The module behind a page: the menu entry whose path is the route or one of its parents. */
export function moduleForPath(pathname: string): string | undefined {
  return NAV_ITEMS.filter(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  ).sort((a, b) => b.path.length - a.path.length)[0]?.privilege
}

/** Whether the signed-in role may create, change or delete an account with `role`. */
export function canManageRole(callerRole: string, role: string): boolean {
  if (role === 'Developer') return callerRole === 'Developer'
  if (role === 'Admin') return FULL_ACCESS_ROLES.includes(callerRole)
  return true
}

/** Privileges in the stored form, with bare module names (older builds) as every action. */
export function normalizePrivileges(privileges: string[]): string[] {
  const result = new Set<string>()
  for (const privilege of privileges) {
    if (privilege.includes(':')) {
      result.add(privilege)
      continue
    }
    const actions =
      PRIVILEGE_MODULES.find((m) => m.module === privilege)?.actions ?? PRIVILEGE_ACTIONS
    for (const action of actions) result.add(privilegeKey(privilege, action))
  }
  return [...result]
}

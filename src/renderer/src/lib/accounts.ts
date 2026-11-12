import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuthStore } from '../store/authStore'
import { notifySessionExpired } from './session'
import { supabase } from './supabase'

/** Profile fields the admin-users Edge Function accepts (app field names). */
export interface AccountProfile {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  role: string
  privileges: string[]
  contactNumber: string
  birthday: string
  gender: string
  address: string
  filePath: string
  officialId?: string
  officialIds?: string[]
}

// `email` is the account's sign-in email; blank = it signs in by username only
type AdminUsersBody =
  | {
      action: 'create'
      username: string
      password: string
      email: string
      profile: AccountProfile
    }
  | {
      action: 'update'
      id: string
      username: string
      password?: string
      email: string
      profile: AccountProfile
    }
  | { action: 'delete'; id: string }

// Accounts live in Supabase Auth, so they are managed through the admin-users Edge Function
// (supabase/functions/admin-users) — it holds the service-role key the app must never ship.
async function invokeAdminUsers(body: AdminUsersBody): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let message = error.message
    let sessionExpired = false
    if (error instanceof FunctionsHttpError) {
      sessionExpired = error.context.status === 401
      if (error.context.status === 404) {
        message =
          'The admin-users function is not deployed yet — see supabase/README.md in candon-lmts-admin.'
      } else {
        const payload = await error.context.json().catch(() => null)
        if (payload?.error) message = String(payload.error)
      }
    }
    sessionExpired ||= /session has expired|not signed in/i.test(message)
    if (sessionExpired) {
      notifySessionExpired()
      useAuthStore.getState().logout()
    }
    throw new Error(message)
  }
  if (data?.error) {
    const message = String(data.error)
    if (/session has expired|not signed in/i.test(message)) {
      notifySessionExpired()
      useAuthStore.getState().logout()
    }
    throw new Error(message)
  }
}

export function createAccount(
  username: string,
  password: string,
  email: string,
  profile: AccountProfile
) {
  return invokeAdminUsers({ action: 'create', username, password, email, profile })
}

export function updateAccount(
  id: string,
  username: string,
  password: string,
  email: string,
  profile: AccountProfile
) {
  return invokeAdminUsers({
    action: 'update',
    id,
    username,
    ...(password ? { password } : {}),
    email,
    profile
  })
}

export function deleteAccount(id: string) {
  return invokeAdminUsers({ action: 'delete', id })
}

export async function getAccountOfficialIds(accountId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_official_links')
    .select('official_id')
    .eq('user_id', accountId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((link) => link.official_id)
}

import { signInEmail, supabase } from './supabase'
import { fromRow } from './db'
import type { AuthUser } from '../types'

/** Signs in with a username or email and password; returns the signed-in user's profile. */
export async function signIn(username: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: await signInEmail(username),
    password
  })
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('Incorrect username or password')
    }
    if (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message)) {
      throw new Error('Login failed. Please check your connection.')
    }
    throw new Error(error.message)
  }

  const { data: row, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profileError || !row || row.role === 'Pending') {
    await supabase.auth.signOut()
    throw new Error(
      profileError?.message ?? 'This account is not activated yet. Ask an administrator.'
    )
  }

  const profile = fromRow<Record<string, unknown>>(row)
  return {
    id: data.user.id,
    username: String(profile.username ?? username),
    firstName: String(profile.firstName ?? ''),
    middleName: String(profile.middleName ?? ''),
    lastName: String(profile.lastName ?? ''),
    birthday: String(profile.birthday ?? ''),
    role: String(profile.role ?? ''),
    privileges: Array.isArray(profile.privileges) ? (profile.privileges as string[]) : [],
    filePath: String(profile.filePath ?? '')
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch {
    // local session is cleared regardless
  }
}

/** True when Supabase still holds a session (it can be gone after the window was closed). */
export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

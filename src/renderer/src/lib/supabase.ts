import { createClient } from '@supabase/supabase-js'

/**
 * Users type a username; Supabase Auth knows them as `<username>@candon-lis.local` (never
 * emailed). Must match AUTH_EMAIL_DOMAIN in supabase/functions/admin-users and candon-app.
 */
export const AUTH_EMAIL_DOMAIN = 'candon-lis.local'

/** localStorage key of the Supabase session — main/index.ts clears it when the window closes. */
export const SUPABASE_AUTH_STORAGE_KEY = 'lis-supabase-auth'

/** Private bucket holding every uploaded document and profile photo. */
export const DOCUMENTS_BUCKET = 'documents'

// The URL and publishable key are public by design (access is enforced by row level security);
// .env can point the app at another project.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://mjnmcnxorpkpddefcrmr.supabase.co'
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_JpBd-MfYbmkoj8SJ3TlgZw_ntNHF5YV'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})

/**
 * Login id → Supabase Auth email. A full email (e.g. the super admin's) is used as-is; a plain
 * username maps to `<username>@candon-lis.local`.
 */
export function usernameToEmail(login: string): string {
  const value = login.trim().toLowerCase()
  return value.includes('@') ? value : `${value}@${AUTH_EMAIL_DOMAIN}`
}

/**
 * The email to sign in with. A username is looked up, since an account may sign in with a real
 * email (public.sign_in_email); without a match it is `<username>@candon-lis.local`.
 */
export async function signInEmail(login: string): Promise<string> {
  if (login.includes('@')) return usernameToEmail(login)
  const { data } = await supabase.rpc('sign_in_email', { login: login.trim() })
  return typeof data === 'string' && data ? data : usernameToEmail(login)
}

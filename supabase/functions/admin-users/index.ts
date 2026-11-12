// Supabase Edge Function: account management for LMTS Admin's Account Management page.
//
// Creating, renaming, re-passwording and deleting Supabase Auth users needs the service-role
// key, which must never ship inside the apps — so the apps call this function instead. It
// checks the caller first: Account Management → Add / Edit / Delete for create / update / delete
// (Developers and Admins can do all), and only Developers may touch Developer accounts.
//
// Body: { action: 'create', username, password, email?, profile }
//       { action: 'update', id, username?, password?, email?, profile }
//       { action: 'delete', id }
// `profile` uses the app's field names (firstName, role, privileges, filePath, …). `email` is the
// account's sign-in email; blank means it signs in by username (<username>@candon-lis.local).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Usernames become Auth emails on this internal domain. Must match AUTH_EMAIL_DOMAIN in
// candon-lmts-admin (src/renderer/src/lib/supabase.ts) and candon-app (src/lib/supabase.ts).
const AUTH_EMAIL_DOMAIN = 'candon-lis.local'
const DOCUMENTS_BUCKET = 'documents'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// app field → public.users column
const PROFILE_FIELDS: Record<string, string> = {
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  suffix: 'suffix',
  role: 'role',
  privileges: 'privileges',
  contactNumber: 'contact_number',
  birthday: 'birthday',
  gender: 'gender',
  address: 'address',
  filePath: 'file_path'
}

const ROLES = ['Developer', 'Admin', 'Secretary', 'Staff', 'View Only', 'S.P MEMBER']
// Roles that can do everything (FULL_ACCESS_ROLES in candon-lmts-admin's lib/permissions.ts)
const FULL_ACCESS = ['Developer', 'Admin']

type Action = 'view' | 'add' | 'edit' | 'delete'
interface Profile {
  id: string
  username: string
  role: string
  privileges: string[] | null
  file_path: string | null
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
}

function cleanUsername(value: unknown): string {
  const username = String(value ?? '').trim()
  if (!username) throw new HttpError(400, 'Username is required')
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
    throw new HttpError(
      400,
      'Username must be 3–40 characters: letters, numbers, dot, dash or underscore only'
    )
  }
  return username
}

/** A real sign-in email, or null for the username-only <username>@candon-lis.local login. */
function cleanEmail(value: unknown): string | null {
  const email = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, 'Enter a valid email address')
  if (email.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) {
    throw new HttpError(400, `@${AUTH_EMAIL_DOMAIN} addresses are reserved for username logins`)
  }
  return email
}

function cleanPassword(value: unknown): string {
  const password = String(value ?? '')
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters')
  return password
}

function toProfileRow(profile: unknown): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (!profile || typeof profile !== 'object') return row
  for (const [field, column] of Object.entries(PROFILE_FIELDS)) {
    if (!(field in profile)) continue
    const value = (profile as Record<string, unknown>)[field]
    if (field === 'privileges') {
      row[column] = Array.isArray(value) ? value.map(String) : []
    } else if (field === 'officialId') {
      const officialId = String(value ?? '').trim()
      if (
        officialId &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          officialId
        )
      ) {
        throw new HttpError(400, 'Select a valid official')
      }
      row[column] = officialId || null
    } else {
      row[column] = value == null ? null : String(value)
    }
  }
  if ('role' in row && !ROLES.includes(String(row.role))) {
    throw new HttpError(400, `Unknown role "${row.role}"`)
  }
  return row
}

function profileOfficialIds(profile: unknown): string[] {
  if (!profile || typeof profile !== 'object') return []
  const profileFields = profile as Record<string, unknown>
  const values = profileFields.officialIds
  const legacyValue = profileFields.officialId
  if (values !== undefined && !Array.isArray(values)) {
    throw new HttpError(400, 'Linked officials must be a list')
  }
  const ids = Array.isArray(values) ? values : legacyValue ? [legacyValue] : []
  const uniqueIds = [...new Set(ids.map((value) => String(value ?? '').trim()).filter(Boolean))]
  if (uniqueIds.length > 100) throw new HttpError(400, 'Select no more than 100 officials')
  if (
    uniqueIds.some(
      (officialId) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          officialId
        )
    )
  ) {
    throw new HttpError(400, 'Select valid officials')
  }
  return uniqueIds
}

async function assertOfficialsExist(admin: SupabaseClient, officialIds: string[]) {
  if (officialIds.length === 0) return
  const { data, error } = await admin
    .from('officials')
    .select('id')
    .in('id', officialIds)
  if (error) throw new HttpError(500, error.message)
  if ((data ?? []).length !== officialIds.length) {
    throw new HttpError(400, 'One or more selected officials do not exist')
  }
}

async function saveOfficialLinks(
  admin: SupabaseClient,
  userId: string,
  officialIds: string[]
) {
  const { error } = await admin.rpc('set_user_official_links', {
    p_user_id: userId,
    p_official_ids: officialIds
  })
  if (error) throw new HttpError(500, error.message)
}

async function assertUsernameFree(admin: SupabaseClient, username: string, exceptId?: string) {
  const { data, error } = await admin.from('users').select('id, username')
  if (error) throw new HttpError(500, error.message)
  const taken = (data ?? []).some(
    (p) => p.id !== exceptId && String(p.username).toLowerCase() === username.toLowerCase()
  )
  if (taken) throw new HttpError(409, `Username "${username}" is already taken`)
}

async function assertEmailFree(admin: SupabaseClient, email: string, exceptId?: string) {
  // users.email mirrors every account's real sign-in email
  const { data, error } = await admin.from('users').select('id').eq('email', email)
  if (error) throw new HttpError(500, error.message)
  if ((data ?? []).some((p) => p.id !== exceptId)) {
    throw new HttpError(409, `${email} is already used by another account`)
  }
}

async function getProfile(admin: SupabaseClient, id: string): Promise<Profile | null> {
  const { data, error } = await admin
    .from('users')
    .select('id, username, role, privileges, file_path')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new HttpError(500, error.message)
  return data
}

/** Same rule as private.can() in the database. A bare module name (older builds) = every action. */
function can(profile: Profile | null, module: string, action: Action): boolean {
  if (!profile) return false
  if (FULL_ACCESS.includes(profile.role)) return true
  if (profile.role === 'Pending') return false
  if (action !== 'view' && profile.role === 'View Only') return false
  const privileges = profile.privileges ?? []
  return privileges.includes(`${module}:${action}`) || privileges.includes(module)
}

/** Developer accounts are for Developers to manage; Admin accounts for Admins and Developers. */
function assertCanManage(callerRole: string, role: unknown, verb: string) {
  if (role === 'Developer' && callerRole !== 'Developer') {
    throw new HttpError(403, `Only a Developer can ${verb} Developer accounts`)
  }
  if (role === 'Admin' && !FULL_ACCESS.includes(callerRole)) {
    throw new HttpError(403, `Only an Admin or Developer can ${verb} Admin accounts`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
    if (!url || !serviceKey) throw new HttpError(500, 'Function is missing its Supabase secrets')
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // ── Who is calling? ──────────────────────────────────────────────────────
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Not signed in')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user)
      throw new HttpError(401, 'Your session has expired — sign in again')

    const caller = await getProfile(admin, auth.user.id)
    const body = await req.json().catch(() => null)
    const action = body?.action
    // Account Management privilege needed: create → Add, update → Edit, delete → Delete
    const needed: Action | null =
      action === 'create'
        ? 'add'
        : action === 'update'
          ? 'edit'
          : action === 'delete'
            ? 'delete'
            : null
    if (!needed) throw new HttpError(400, 'Unknown action')
    if (!caller || !can(caller, 'Account Management', needed)) {
      throw new HttpError(403, 'You are not allowed to manage accounts')
    }

    // ── Create ───────────────────────────────────────────────────────────────
    if (action === 'create') {
      const username = cleanUsername(body.username)
      const password = cleanPassword(body.password)
      const row = toProfileRow(body.profile)
      const officialIds = profileOfficialIds(body.profile)
      await assertOfficialsExist(admin, officialIds)
      if (!row.role) row.role = 'Staff'
      assertCanManage(caller.role, row.role, 'create')
      const email = cleanEmail(body.email)
      await assertUsernameFree(admin, username)
      if (email) await assertEmailFree(admin, email)

      const { data: created, error } = await admin.auth.admin.createUser({
        email: email ?? usernameToEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username }
      })
      if (error || !created.user)
        throw new HttpError(400, error?.message ?? 'Could not create user')

      // The on_auth_user_created trigger inserted a 'Pending' users row — fill it in.
      const { data: profile, error: profileError } = await admin
        .from('users')
        .update({ ...row, username })
        .eq('id', created.user.id)
        .select()
        .single()
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id)
        throw new HttpError(500, profileError.message)
      }
      try {
        await saveOfficialLinks(admin, created.user.id, officialIds)
      } catch (error) {
        await admin.auth.admin.deleteUser(created.user.id)
        throw error
      }
      return json({ profile })
    }

    // ── Update ───────────────────────────────────────────────────────────────
    if (action === 'update') {
      const id = String(body.id ?? '')
      const target = id ? await getProfile(admin, id) : null
      if (!target) throw new HttpError(404, 'Account not found')
      const row = toProfileRow(body.profile)
      const officialIds = profileOfficialIds(body.profile)
      await assertOfficialsExist(admin, officialIds)
      assertCanManage(caller.role, target.role, 'change')
      if ('role' in row) assertCanManage(caller.role, row.role, 'change')

      const authChanges: { email?: string; password?: string; user_metadata?: object } = {}
      let username = String(target.username)
      if (body.username != null && String(body.username).trim() !== target.username) {
        username = cleanUsername(body.username)
        await assertUsernameFree(admin, username, id)
        authChanges.user_metadata = { username }
        row.username = username
      }
      // Sign-in email: the one sent (blank = username login). Without one, a real email stays and
      // an internal <username>@candon-lis.local login follows a username change.
      const { data: existing } = await admin.auth.admin.getUserById(id)
      const currentEmail = (existing.user?.email ?? '').toLowerCase()
      const usernameLogin = !currentEmail || currentEmail.endsWith(`@${AUTH_EMAIL_DOMAIN}`)
      const email =
        'email' in body
          ? (cleanEmail(body.email) ?? usernameToEmail(username))
          : usernameLogin
            ? usernameToEmail(username)
            : currentEmail
      if (email !== currentEmail) {
        if (!email.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) await assertEmailFree(admin, email, id)
        authChanges.email = email
      }
      if (body.password) authChanges.password = cleanPassword(body.password)
      if (Object.keys(authChanges).length) {
        const { error } = await admin.auth.admin.updateUserById(id, {
          ...authChanges,
          ...(authChanges.email ? { email_confirm: true } : {})
        })
        if (error) throw new HttpError(400, error.message)
      }

      // Nothing but the login changed (e.g. only the email): just return the profile
      const { data: profile, error } = Object.keys(row).length
        ? await admin.from('users').update(row).eq('id', id).select().single()
        : await admin.from('users').select().eq('id', id).single()
      if (error) throw new HttpError(500, error.message)
      await saveOfficialLinks(admin, id, officialIds)
      return json({ profile })
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const id = String(body.id ?? '')
      if (id === auth.user.id) throw new HttpError(400, 'You cannot delete your own account')
      const target = id ? await getProfile(admin, id) : null
      if (!target) throw new HttpError(404, 'Account not found')
      assertCanManage(caller.role, target.role, 'delete')
      const { error } = await admin.auth.admin.deleteUser(id) // users row cascades
      if (error) throw new HttpError(400, error.message)
      if (target.file_path && !/^https?:\/\//i.test(target.file_path)) {
        const { error: storageError } = await admin.storage
          .from(DOCUMENTS_BUCKET)
          .remove([target.file_path])
        if (storageError) {
          throw new HttpError(
            500,
            `Account deleted, but its profile photo could not be removed: ${storageError.message}`
          )
        }
      }
      return json({ ok: true })
    }

    throw new HttpError(400, 'Unknown action')
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: message }, status)
  }
})

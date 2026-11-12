import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const MODULES: Record<string, { privilege: string; label: string; route: string }> = {
  ordinances: { privilege: 'Ordinances', label: 'Ordinances', route: '/general-ordinances' },
  resolutions: { privilege: 'Resolutions', label: 'Resolutions', route: '/general-resolutions' },
  draft_ordinances: {
    privilege: 'Draft Ordinance/s and Draft Resolutions',
    label: 'Draft Ordinances',
    route: '/draft-ordinances'
  },
  draft_resolutions: {
    privilege: 'Draft Ordinance/s and Draft Resolutions',
    label: 'Draft Resolutions',
    route: '/draft-resolutions'
  },
  communications: {
    privilege: 'Other Communications',
    label: 'Communications',
    route: '/communications-others'
  },
  sessions: {
    privilege: 'Calendar of Business',
    label: 'Order of Business',
    route: '/regular-session'
  },
  // The sessions table's old name — still sent by LMTS Admin builds from before the rename
  // (20261112100000_rename_minutes_to_sessions.sql). Remove with the `minutes` view.
  minutes: {
    privilege: 'Calendar of Business',
    label: 'Order of Business',
    route: '/regular-session'
  },
  session_minutes: {
    privilege: 'Session Minutes',
    label: 'Session Minutes',
    route: '/session-minutes'
  },
  transcripts: {
    privilege: 'Transcript of Proceedings',
    label: 'Transcripts',
    route: '/proceedings'
  },
  other_matters: {
    privilege: 'Other Matters',
    label: 'Other Matters',
    route: '/other-matters'
  },
  committee_referrals: {
    privilege: 'Committee Referrals',
    label: 'Committee Referrals',
    route: '/committee-referrals'
  },
  committee_reports: {
    privilege: 'Committee Reports',
    label: 'Committee Reports & Minutes',
    route: '/committee-reports'
  },
  committee_transcripts: {
    privilege: 'Committee Transcripts',
    label: 'Hearing/Meeting Transcripts',
    route: '/committee-transcripts'
  },
  public_hearing_minutes: {
    privilege: 'Public Hearing Minutes',
    label: 'Public Hearing Minutes',
    route: '/public-hearing-minutes'
  },
  committees: {
    privilege: 'Standing Committees',
    label: 'Standing Committees',
    route: '/standing-committees'
  },
  brgy_actions: {
    privilege: 'Barangay Actions',
    label: 'Barangay Actions',
    route: '/brgy-ordinances'
  },
  brgy_reviews: {
    privilege: 'Barangay Review',
    label: 'Barangay Review',
    route: '/brgy-reviews'
  },
  tricycle_franchises: {
    privilege: 'Tricycle Franchise',
    label: 'Tricycle Franchise',
    route: '/tricycle-franchise'
  },
  officials: { privilege: 'S.P Members', label: 'Officials', route: '/officials' },
  terms: { privilege: 'S.P Members', label: 'Terms', route: '/terms' }
}

const FULL_ACCESS = new Set(['Admin', 'Developer'])

type UserProfile = { id: string; role: string; privileges: string[] | null }

function canAccess(profile: UserProfile, privilege: string, action: string): boolean {
  if (FULL_ACCESS.has(profile.role)) return true
  if (profile.role === 'Pending' || (action !== 'view' && profile.role === 'View Only')) {
    return false
  }
  const privileges = profile.privileges ?? []
  return privileges.includes(privilege) || privileges.includes(`${privilege}:${action}`)
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
    if (!url || !serviceKey)
      return response({ error: 'Function is missing its Supabase secrets' }, 500)

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const authorization = req.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) return response({ error: 'Not signed in' }, 401)
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) {
      console.error('[notify-users] could not verify caller session', {
        status: authError?.status,
        code: authError?.code,
        message: authError?.message
      })
      return response({ error: 'Could not verify the sign-in session. Please retry.' }, 401)
    }

    const body = await req.json()
    let recipients: { id: string }[]
    let eventId: string
    let title: string
    let text: string
    let route: string
    let module: string
    let recordId: string | null

    if (body.type === 'chat_message') {
      const messageId = typeof body.messageId === 'string' ? body.messageId : ''
      const { data: message, error: messageError } = await admin
        .from('chat_messages')
        .select('id, conversation_id, sender_id, body')
        .eq('id', messageId)
        .eq('sender_id', auth.user.id)
        .maybeSingle()
      if (messageError) throw messageError
      if (!message) return response({ error: 'Message not found or not sent by you' }, 403)

      const { data: participants, error: participantsError } = await admin
        .from('chat_participants')
        .select('user_id')
        .eq('conversation_id', message.conversation_id)
        .neq('user_id', auth.user.id)
      if (participantsError) throw participantsError

      const recipientIds = (participants ?? []).map((participant) => participant.user_id)
      const { data: preferences, error: preferencesError } = recipientIds.length
        ? await admin
            .from('user_notification_preferences')
            .select('user_id, messages_enabled')
            .in('user_id', recipientIds)
        : { data: [], error: null }
      if (preferencesError) throw preferencesError
      const messagesDisabled = new Set(
        (preferences ?? [])
          .filter((preference) => !preference.messages_enabled)
          .map((preference) => preference.user_id)
      )

      const { data: sender, error: senderError } = await admin
        .from('users')
        .select('username, first_name, last_name')
        .eq('id', auth.user.id)
        .maybeSingle()
      if (senderError) throw senderError
      const senderName =
        [sender?.first_name, sender?.last_name].filter(Boolean).join(' ') ||
        sender?.username ||
        'New message'
      title = senderName
      text = message.body.trim().slice(0, 180)
      route = `/chat/${message.conversation_id}`
      module = 'Messages'
      recordId = message.id
      eventId = message.id
      recipients = recipientIds.filter((id) => !messagesDisabled.has(id)).map((id) => ({ id }))
    } else {
      const table = typeof body.table === 'string' ? body.table : ''
      const action = typeof body.action === 'string' ? body.action : ''
      const moduleConfig = MODULES[table]
      if (!moduleConfig || !['created', 'updated', 'deleted'].includes(action)) {
        return response({ error: 'Unsupported notification event' }, 400)
      }
      const moduleInfo =
        table === 'communications' && body.source === 'LCE'
          ? {
              ...moduleConfig,
              label: 'Communications Received from LCE',
              route: '/communications-lce'
            }
          : moduleConfig

      const { data: profile, error: profileError } = await admin
        .from('users')
        .select('id, role, privileges')
        .eq('id', auth.user.id)
        .maybeSingle()
      if (profileError) throw profileError
      const requiredAction = action === 'created' ? 'add' : action === 'updated' ? 'edit' : 'delete'
      if (!profile || !canAccess(profile, moduleInfo.privilege, requiredAction)) {
        return response({ error: 'You cannot notify users about this module' }, 403)
      }

      const { data: allUsers, error: usersError } = await admin
        .from('users')
        .select('id, role, privileges')
        .neq('role', 'Pending')
      if (usersError) throw usersError
      const eligibleUsers = (allUsers ?? []).filter(
        (user) => user.id !== auth.user.id && canAccess(user, moduleInfo.privilege, 'view')
      )
      const { data: preferences, error: preferencesError } = eligibleUsers.length
        ? await admin
            .from('user_notification_preferences')
            .select('user_id, app_enabled')
            .in(
              'user_id',
              eligibleUsers.map((user) => user.id)
            )
        : { data: [], error: null }
      if (preferencesError) throw preferencesError
      const appDisabled = new Set(
        (preferences ?? [])
          .filter((preference) => !preference.app_enabled)
          .map((preference) => preference.user_id)
      )
      recipients = eligibleUsers
        .filter((user) => !appDisabled.has(user.id))
        .map((user) => ({ id: user.id }))

      eventId =
        typeof body.eventId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          body.eventId
        )
          ? body.eventId
          : crypto.randomUUID()
      const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 180) : ''
      const hasFile = body.hasFile === true
      const verb =
        action === 'created'
          ? hasFile
            ? 'New file uploaded'
            : 'New record added'
          : action === 'updated'
            ? hasFile
              ? 'Record or file updated'
              : 'Record updated'
            : 'Record deleted'
      title = `${moduleInfo.label}: ${verb}`
      text = summary || `There is an update in ${moduleInfo.label}.`
      route = moduleInfo.route
      module = moduleInfo.label
      recordId = typeof body.recordId === 'string' ? body.recordId : null
    }

    if (!recipients.length) {
      return response({ inserted: 0, pushSent: 0, recipientCount: 0, deviceCount: 0 })
    }

    const { data: inserted, error: insertError } = await admin
      .from('notifications')
      .upsert(
        recipients.map((user) => ({
          user_id: user.id,
          event_id: eventId,
          title,
          body: text,
          route,
          module,
          record_id: recordId
        })),
        { onConflict: 'user_id,event_id', ignoreDuplicates: true }
      )
      .select('id, user_id')
    if (insertError) throw insertError

    const insertedUserIds = [...new Set((inserted ?? []).map((row) => row.user_id))]
    if (!insertedUserIds.length) return response({ inserted: 0, pushSent: 0 })
    const { data: tokenRows, error: tokenError } = await admin
      .from('expo_push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', insertedUserIds)
    if (tokenError) throw tokenError
    const deviceCount = tokenRows?.length ?? 0

    let pushSent = 0
    let pushFailed = 0
    const pushErrors: string[] = []
    const invalidTokens: string[] = []
    for (let index = 0; index < (tokenRows ?? []).length; index += 100) {
      const batch = (tokenRows ?? []).slice(index, index + 100)
      try {
        const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(
            batch.map((row) => ({
              to: row.expo_push_token,
              sound: 'default',
              priority: 'high',
              channelId: 'default',
              title,
              body: text,
              data: {
                route,
                notificationId: inserted?.find((item) => item.user_id === row.user_id)?.id
              }
            }))
          )
        })
        if (!pushResponse.ok) {
          pushFailed += batch.length
          pushErrors.push(`Expo Push API returned HTTP ${pushResponse.status}`)
          console.error(`Expo push service returned HTTP ${pushResponse.status}`)
          continue
        }

        const result = await pushResponse.json()
        const tickets = Array.isArray(result.data)
          ? (result.data as Array<{
              status?: string
              message?: string
              details?: { error?: string }
            }>)
          : []
        const successfulTickets = tickets.filter((ticket) => ticket.status === 'ok').length
        pushSent += successfulTickets
        pushFailed += batch.length - successfulTickets
        if (tickets.length === 0) {
          pushErrors.push('Expo Push API returned no tickets')
        }
        tickets.forEach((ticket, ticketIndex) => {
          if (ticket.status !== 'ok') {
            pushErrors.push(ticket.details?.error ?? ticket.message ?? 'Unknown Expo push error')
          }
          if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(batch[ticketIndex].expo_push_token)
          }
        })
      } catch (error) {
        pushFailed += batch.length
        pushErrors.push(error instanceof Error ? error.message : 'Unknown Expo push error')
        console.error('Expo push delivery failed', error)
      }
    }

    if (invalidTokens.length) {
      const { error: cleanupError } = await admin
        .from('expo_push_tokens')
        .delete()
        .in('expo_push_token', invalidTokens)
      if (cleanupError) console.error('Could not remove invalid Expo push tokens', cleanupError)
    }

    return response({
      inserted: inserted?.length ?? 0,
      pushSent,
      pushFailed,
      pushErrors: [...new Set(pushErrors)].slice(0, 5),
      recipientCount: recipients.length,
      deviceCount
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected notification error'
    console.error('[notify-users] request failed', error)
    return response({ error: message }, 500)
  }
})

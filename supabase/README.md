# Candon LMTS — Supabase backend

Shared by **candon-lmts-admin** (this repo) and **candon-app** (mobile). Project:
`https://mjnmcnxorpkpddefcrmr.supabase.co`

## One-time setup

1. **Database** — Dashboard → SQL Editor → paste
   [`migrations/20261028000000_init.sql`](migrations/20261028000000_init.sql) → Run.
   It creates every table, the security policies, the private `documents` storage bucket and
   realtime. Re-running it is safe.
2. **Account function** — Dashboard → Edge Functions → Deploy a new function → Via editor →
   name it `admin-users`, paste [`functions/admin-users/index.ts`](functions/admin-users/index.ts),
   deploy. Then open the function's settings and turn **off** "Enforce JWT verification" (the
   function checks the caller's session itself).
   With the CLI instead: `supabase functions deploy admin-users --project-ref mjnmcnxorpkpddefcrmr`
   (it reads `verify_jwt = false` from `config.toml`).
3. **Super admin** — the login `adolfotristanjames@gmail.com` (username `superadmin`) was created
   on 2026-10-28. The SQL from step 1 marks its email as confirmed (no confirmation email needed)
   and gives it the Admin role. Sign in to the apps with that email and its password.
   More admins: create them from the desktop app's Account Management page, or Authentication →
   Users → Add user (`<username>@candon-lis.local`, tick **Auto Confirm User**) and pick their role
   from the dropdown in **Table Editor → `users`**.

4. **Close public sign-up** — Authentication → Sign In / Providers → turn off
   **Allow new users to sign up**. Accounts are created from the desktop app's Account
   Management page (through the `admin-users` function).

## Linking mobile accounts to officials

1. Apply [`migrations/20261101081600_user_official_links.sql`](migrations/20261101081600_user_official_links.sql)
   after the initial schema. It adds the optional `users.official_id` link to the Officials roster.
2. Deploy the updated account-management function:
   `supabase functions deploy admin-users --project-ref mjnmcnxorpkpddefcrmr`
3. In LMTS Admin → Account Management, edit each S.P. Member account and choose its matching
   **Linked Official**. The mobile Dashboard's **Authored / Co-Authored / Sponsor** tab uses that
   official link to find matching records. New and re-saved draft ordinances, draft resolutions,
   and communications store contributor official IDs automatically. Older records without IDs
   still use an exact display-name match; edit and save them in Desktop to store their IDs
   permanently.
4. To link the same person across multiple council terms, apply
   [`migrations/20261101120000_multi_term_user_official_links.sql`](migrations/20261101120000_multi_term_user_official_links.sql)
   and redeploy `admin-users`. In Account Management, edit the account and select every
   term-specific Official record for that person. The mobile dashboard then matches all linked
   Official IDs.

## Dashboard birthday greetings

Apply [`migrations/20261101093000_upcoming_birthday_greetings.sql`](migrations/20261101093000_upcoming_birthday_greetings.sql)
to enable the Desktop and mobile dashboards to show greetings for every active user's birthday
within the next 3 days. The function only returns display names and the number of days until the
birthday; it does not expose full birth dates to other users.
Apply [`migrations/20261101093100_birthday_greeting_official_photos.sql`](migrations/20261101093100_birthday_greeting_official_photos.sql)
to include the linked Official's chart photo in each greeting (falling back to the account photo).

## Mobile notifications

1. Apply [`migrations/20261029234000_notifications_and_push_tokens.sql`](migrations/20261029234000_notifications_and_push_tokens.sql)
   after the initial schema. It adds per-user inbox records and Expo push-token storage.
2. Apply [`migrations/20261101135000_fix_expo_push_token_upsert_grants.sql`](migrations/20261101135000_fix_expo_push_token_upsert_grants.sql)
   so authenticated mobile users can safely upsert only their own Expo push-token columns (RLS
   continues to restrict rows to the signed-in user).
3. Apply [`migrations/20261030114700_notification_preferences.sql`](migrations/20261030114700_notification_preferences.sql)
   to allow users to manage app-update and message notification preferences from their mobile profile.
4. Deploy or redeploy the notification function:
   `supabase functions deploy notify-users --project-ref mjnmcnxorpkpddefcrmr`
   (`verify_jwt = false` is configured because the function validates the user's Supabase
   session itself; it uses the Supabase service-role key only on the server.)
5. Configure the EAS project's iOS/APNs and Android/FCM push credentials. Build and install a
   new native app version after adding `expo-notifications`; push tokens and remote pushes do
   not work in an older native binary. Users must grant notification permission.
5. The desktop app sends inbox and push notifications for supported record/file changes.
   Recipients are users with view access to that module; the desktop actor is excluded. Mobile
   chat messages also create inbox and push notifications for other conversation participants.
   The mobile Profile page has separate switches for record/file alerts and chat messages; each
   switch disables both inbox entries and push delivery for that category. If push delivery fails,
   the notification remains in the in-app inbox. The dashboard badge counts unread inbox records,
   and selecting a record or message notification marks it read before navigating.

## Password recovery email

The mobile app uses a recovery OTP (not a reset link). The hosted Recovery email template is
configured in Authentication → Email Templates to include `{{ .Token }}`. Its branded source is
[`templates/recovery.html`](templates/recovery.html), with the intended subject declared in
`config.toml`. On a new Supabase project, configure custom SMTP in Authentication → SMTP Settings
before applying the Recovery template; the Free tier does not allow hosted template changes with
Supabase's default email provider.

The sender display name is configured in Authentication → SMTP Settings as the SMTP sender name.
Use **Candon eSession** and a verified sender email/domain from your SMTP provider. Email-template
branding changes the message body, not the sender identity. SMTP credentials must be stored in
Supabase settings and must not be committed to this repository.

## Mobile chat

Apply [`migrations/20261030003000_chat_and_chatrooms.sql`](migrations/20261030003000_chat_and_chatrooms.sql)
after the notification migration to enable direct messages and named group rooms. Then apply
[`migrations/20261030010000_chat_inbox_delete.sql`](migrations/20261030010000_chat_inbox_delete.sql)
to add per-user inbox hiding and the `hide_chat_for_me` RPC used by the mobile Delete action.
Apply [`migrations/20261030012000_chat_message_replies_delete.sql`](migrations/20261030012000_chat_message_replies_delete.sql)
to enable message replies and sender-only message deletion.
The chat migration creates membership-scoped row-level security policies, contact/inbox RPCs,
and Realtime publication for message and membership changes. Only active users can be found or
invited; users outside a room cannot read its messages. Deploy both migrations with:

`supabase db push --project-ref mjnmcnxorpkpddefcrmr`

If the chat migrations were previously run manually in the Supabase SQL Editor, run the
`20261030010000_chat_inbox_delete.sql` migration there as well. If it is already applied but the
app still reports that `hide_chat_for_me` is missing from the schema cache, run
`NOTIFY pgrst, 'reload schema';` in the SQL Editor and retry Delete.

## How it fits together

- **Login**: users type a username, and the apps sign in to Supabase Auth as
  `<username>@candon-lis.local` (never emailed). This legacy domain is kept stable so existing
  accounts and mobile sign-ins continue to work. An entry containing `@` (like the super admin's
  email) is used as the email itself.
- **Users**: `public.users` lists every account with its username, role and privileges — the
  place to see (and, in the Table Editor, change) anyone's role. `role` is the `user_role` enum
  (`Admin`, `Secretary`, `Staff`, `View Only`, `S.P MEMBER`, `Pending`). Mobile self-registration
  does not require email confirmation; new accounts still start as `Pending` (no access) until
  the desktop app's Account Management page or an admin sets their role. Passwords stay in
  Supabase Auth (Authentication → Users), never in this table.
- **Security**: every module table can be read by any signed-in member and written by Admins or
  members holding that module's privilege (same names as the desktop sidebar). Files follow the
  same rule by storage folder.
- **Files**: the private `documents` bucket; records store the object path in `file_path` and
  the apps open files through 1-hour signed URLs.
- **Schema changes**: add a new file in `migrations/` and mirror new columns in
  `TABLE_COLUMNS` (`src/renderer/src/lib/db/schema.ts` here and `src/lib/db/schema.ts` in
  candon-app). Fields without a column are kept in each table's `extra` jsonb meanwhile.

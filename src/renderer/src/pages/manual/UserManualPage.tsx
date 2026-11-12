import {
  Activity,
  Bell,
  BookOpen,
  CheckCircle2,
  FileText,
  Link2,
  MessageSquare,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react'
import { Layout, PageContainer } from '../../components/layout/Layout'
import { PageHeader } from '../../components/ui/PageHeader'

const sections = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: CheckCircle2,
    intro:
      'How an administrator or staff member enters the system and works through the main screens.',
    steps: [
      'Open LMTS Admin and sign in with the username or email and password issued by the administrator. The app checks the account and loads its role and privileges.',
      'After sign-in, the Dashboard opens. The left sidebar lists only the modules available to your account; expand a group such as Sessions or Administration to see its pages.',
      'Open a module, use its search/filter controls to find a record, and select Refresh if you need current server data.',
      'Use Add to create, the pencil/edit action to update, the trash/delete action to remove, and the open/file action or double-click to open an attachment. These actions appear only when the account has the needed privilege.',
      'Use the breadcrumb to identify your current page. Use the profile control at the lower left to review your account or log out.'
    ]
  },
  {
    id: 'accounts',
    title: 'Account Management',
    icon: Users,
    intro:
      'Account creation and editing are handled through the Administration page. New accounts are created in Supabase Auth and their LMTS profile is stored in the users table.',
    steps: [
      'Open Administration → Account Management. Search by name, username, or email to find an existing account; select Refresh to reload the list.',
      'Select Create Account to add a user, or the pencil action on a row to edit it. The form requires username, email, first name, and last name; a password is required only when creating an account.',
      'Choose the role and set permissions if applicable. When editing a password, leave New Password blank to keep the current password.',
      'For an S.P. Member, search Linked Officials by name, position, or council term and check every Official record that belongs to the account holder.',
      'Optionally fill in the remaining profile details and choose a profile picture. Select Save and wait for the success message.',
      'If a save fails, read the error toast. If the account was saved but the old profile picture could not be removed, the account update still succeeded; report the cleanup warning to an administrator.'
    ]
  },
  {
    id: 'permissions',
    title: 'Roles and permissions',
    icon: ShieldCheck,
    intro:
      'The sidebar visibility and server-side actions use the account role and module privileges. A hidden menu item is not a substitute for server authorization.',
    steps: [
      'Developer and Admin have full access. Give these roles only to trusted administrators.',
      'For Staff, Secretary, or S.P. Member accounts, open the account form’s Privileges matrix. Each row is a module and each column is View, Add, Edit, or Delete.',
      'Select View to let a user open a module. Selecting Add, Edit, or Delete automatically includes View. Clearing View also clears the other actions for that module.',
      'View Only can receive View privileges only. It cannot change records even if a write action is requested.',
      'Save the account after changes. On mobile, sign out and back in if an old profile is still cached.',
      'A database or permission error means the server rejected the operation; do not assume a change was saved unless the app confirms success.'
    ]
  },
  {
    id: 'terms-officials',
    title: 'Council terms and Officials setup',
    icon: Link2,
    intro:
      'Set up the council structure before linking member accounts or entering term-specific session and committee records.',
    steps: [
      'Open City Councils → Terms and select Add Term. Enter a unique term name; start date, end date, and remarks are optional. The end date cannot be earlier than the start date.',
      'Save the term. The app determines whether a term is Current, Upcoming, or Past from its dates; the term status is informational and does not itself grant permissions.',
      'Open City Councils → Officials and select Add Official. Enter first and last name, position, and the council term. The current term is preselected when available.',
      'Optionally select Reports To to build the organization chart. Do not select the Official itself or one of its descendants, because that would create a reporting loop.',
      'Add the Official’s chart/profile photo if available, then Save. Use the search field to confirm the person appears under the expected term and position.',
      'If a person serves in another term, create or maintain a separate Official entry for that term. Then edit the person’s mobile account and link all term-specific Official entries.'
    ]
  },
  {
    id: 'records',
    title: 'Record lifecycle: create, update, and delete',
    icon: FileText,
    intro:
      'Most record pages follow the same save lifecycle. Required fields and whether a PDF is mandatory depend on the selected module.',
    steps: [
      'Open the appropriate sidebar module. Search the loaded record fields using the hint in the search box; use term/category filters where shown. Search and filters narrow the list—they do not change saved data.',
      'Select Add. Complete the required fields, verify the category/term/session references, and attach the required file if the form indicates one is required.',
      'Select Save. For records with a file, the app uploads the file to private storage and saves its path with the record. If the record save fails after upload, the app attempts to remove the unused upload.',
      'After a successful save, the list reloads and the app records an Activity Log entry. Supported modules then attempt mobile notification delivery. A notification warning does not undo a successful record save.',
      'To update, open the row’s edit action, change the needed fields, and Save. If replacing a file, the new file is saved with the record and the previous stored file is removed after success.',
      'To delete, select the row’s trash action and read the confirmation prompt. Confirm only after checking the record identity. Records with attachments use the delete-with-file flow.',
      'A failed validation, permission check, or server save shows an error. Read it and correct the form or ask an administrator; do not repeatedly create the same record without checking whether the previous save succeeded.'
    ]
  },
  {
    id: 'module-map',
    title: 'Module map and record relationships',
    icon: BookOpen,
    intro: 'Use this map to choose the right page and understand where related records are stored.',
    steps: [
      'Archive → Ordinances and Resolutions contains the approved/general and categorized ordinance or resolution records, including appropriation, tax, commendation, and posthumous categories.',
      'Sessions → Order of Business stores Regular Session and Special Session entries. Each entry can be linked to a term and has its own date, session number, attendance, call-to-order details, prayer, adjournment time, and optional file.',
      'Sessions → Session Minutes, Transcript, and Other Matters are separate record types. Enter them in their own modules; do not confuse an Order of Business session entry with its attached minutes or transcript.',
      'Committees contains referrals, reports/minutes, hearing/meeting transcripts, public hearing minutes, and the standing committee registry. When a form asks for a committee or term, select the existing registry entry so the relationship is consistent.',
      'Draft Documents contains Draft Ordinances and Draft Resolutions. Communications is separated into items received from the LCE and items received from Others.',
      'Barangay & Franchise contains Barangay Actions (ordinance/resolution categories), Barangay Review, and Tricycle Franchise records.',
      'City Councils contains Officials, Organization Chart, and Terms. Officials are separate per term; the Organization Chart is built from Officials’ Reports To links.',
      'For referrals to a draft or communication, use the Draft Code reference field to select the source record. The reference stores the source document code; opening the referral locates and opens the source file.'
    ]
  },
  {
    id: 'sessions',
    title: 'Session and committee workflow',
    icon: BookOpen,
    intro:
      'Use the term and session registries consistently so mobile lists, reports, and cross-references agree.',
    steps: [
      'Create or confirm the council term under City Councils → Terms.',
      'Create the Order of Business session and set its session number, session type, date, and term. Add attendance and other session details, and attach the file if applicable.',
      'Use the session number and term consistently when entering related session minutes, transcripts, other matters, committee reports, and referrals.',
      'For committee records, choose the term and committee from the available registry fields rather than typing a different spelling. This allows term-based lists and filters to remain consistent.',
      'For a committee referral, select its draft reference by code. Before opening the referral file, verify that the referenced draft/communication exists and has an attachment.',
      'Use category tabs and term filters to review the resulting records. These filters change the displayed list, not the underlying record.'
    ]
  },
  {
    id: 'contributors-dashboard',
    title: 'Author, Co-author, Sponsor, and mobile Dashboard',
    icon: Users,
    intro:
      'The mobile “Authored / Co-Authored / Sponsor” tab is based on the Official IDs saved with contributor fields, with a legacy exact-name fallback.',
    steps: [
      'In Account Management, edit the S.P. Member account and search Linked Officials by name, position, or term.',
      'Select every term-specific Official row belonging to that person, then save the account.',
      'When creating or editing a Draft Ordinance, Draft Resolution, or Communication, select contributors from the Officials picker for Author, Co-author, and Sponsor. Prefer selecting the registry entry over manually typing a name.',
      'Save the record. The Desktop stores contributor names and Official IDs. IDs give the mobile Dashboard a reliable match even if display-name formatting differs.',
      'The mobile app combines the account’s linked Official IDs, then matches them against author/co-author/sponsor Official IDs. Older records without IDs are matched using normalized legacy names.',
      'The Dashboard’s Pending and Approved tabs use the record status. The Authored / Co-Authored / Sponsor tab shows matched drafts and communications and labels each matching role.',
      'If an older item is missing from the mobile tab, edit and save it in Desktop using the Official picker. Also verify the account’s links for every applicable term.'
    ]
  },
  {
    id: 'notifications',
    title: 'Notification and chat delivery flow',
    icon: Bell,
    intro:
      'Record persistence, in-app inbox notifications, push-token lookup, and Expo delivery are separate steps. A failure at the notification step does not roll back a saved record or chat message.',
    steps: [
      'For a supported Desktop record change, the app first saves the record. After success, it invokes the notify-users Edge Function with the table, action, record ID, summary, and event ID.',
      'The function verifies the sender’s session and permission for that module/action. It selects active users with View access, excludes the sender, and excludes recipients who turned off app notifications.',
      'The function inserts an in-app notification for each eligible recipient, then looks up that recipient’s registered expo_push_tokens and sends push requests to Expo.',
      'For chat, the message is inserted first. The function verifies the message belongs to the sender, finds the other conversation participants, and excludes those who turned off message notifications.',
      'A mobile user registers a device token after signing in and granting OS notification permission. If the token table reports a database permission error, the device registration did not succeed and push delivery may show devices: 0.',
      'Read delivery logs in order: recipients is the eligible user count; devices is the registered token count; acceptedByExpo is tickets accepted by Expo; failed and errors describe delivery rejections. An accepted Expo ticket is not proof the OS displayed it.',
      'If a Desktop warning says the record was saved but notification failed, confirm the record in its module first. Then report the exact error; do not recreate the record just to retry its alert.',
      'On the mobile app, open Profile → Notification Preferences. Turn App notifications on/off for record and file updates, or Message notifications on/off for direct and group chat. Each switch saves independently and shows a success or error message.',
      'For push delivery, also allow notifications in the phone OS settings. Turning off an in-app preference prevents that notification type even if the device token and OS permission are valid.'
    ]
  },
  {
    id: 'mobile-chat',
    title: 'Mobile chat workflow',
    icon: MessageSquare,
    intro: 'Direct and group chat messages are saved before the push-notification request is made.',
    steps: [
      'Sign in to the mobile app with an account that can access the intended conversation.',
      'Open the existing direct or group conversation, enter the message, and send it. If replying to a message, select that message first so the new message stores its reply reference.',
      'The app inserts the message into chat_messages. If this insert fails, the message was not sent; read the error and retry only after checking connectivity.',
      'After the insert succeeds, the app calls notify-users for that message. The function targets the other conversation participants, not the sender, and checks each recipient’s Message notifications preference.',
      'If the notification call fails, the message itself remains saved and visible in the conversation. Check the recipient’s registered device, OS permission, and Message notifications switch before escalating the delivery error.',
      'Use the conversation to confirm message delivery separately from push alerts; a missing push does not mean the chat message failed to save.'
    ]
  },
  {
    id: 'activity-log',
    title: 'Activity Log',
    icon: Activity,
    intro:
      'The Activity Log records user actions for later review; it does not reverse database changes.',
    steps: [
      'Open Administration → Activity Log.',
      'Search by user name, activity description, or date. Entries are shown newest first and can be paged.',
      'After creating, updating, or deleting a supported record or account, check the newest entry to confirm which user action was recorded.',
      'If a record is wrong, use the record module’s edit/delete flow after checking permissions. The log itself is read-only and cannot restore a deleted record.'
    ]
  },
  {
    id: 'dashboard',
    title: 'Dashboard and daily review',
    icon: Activity,
    intro: 'Use the Dashboard for an at-a-glance view of archived measures and recent activity.',
    steps: [
      'Open Dashboard from the top of the sidebar. Review the total cards and charts for the displayed ordinance/resolution categories.',
      'Use the recent activity or record links, where available, to navigate to the corresponding module and verify details there.',
      'Birthday greetings are generated from active user profiles and, when available, use the linked Official photo. If a greeting is incorrect, correct the account birthday or Official/account photo at its source.',
      'Dashboard totals are summaries, not a replacement for searching the source module. Use the module page to filter by category, term, and full record fields.'
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting checklist',
    icon: Search,
    intro: 'Follow the relevant diagnostic flow and include the exact error when asking for help.',
    steps: [
      'A module is missing: check the signed-in user’s role, the module’s View permission, and whether the user signed in again after permissions changed.',
      'A user cannot add/edit/delete: verify both View and the requested action privilege. Also verify the action against the actual server error; the UI may hide controls but the database remains authoritative.',
      'A mobile user sees no authored records: verify links for all term-specific Official entries, then check that contributor fields use those Official records. Re-save a legacy record with the Officials picker to store IDs.',
      'A push log says devices: 0: the eligible recipient has no token registered. On their device, open the current mobile build while signed in, grant OS notification permission, and check push-token registration logs/database grants.',
      'A push log says acceptedByExpo is greater than 0 but the phone shows nothing: check the OS notification permission, Android channel, Focus/Do Not Disturb, and the recipient’s preference switch. Expo acceptance is not OS display confirmation.',
      'A record saved but its notification failed: confirm the saved record first; capture the full warning and corresponding function/client logs. The notification call does not undo the record.',
      'A refresh-token error appears: sign in again if that token is already invalid. While the Desktop app remains open, automatic refresh keeps the session current; restarting the app clears the local login by design.',
      'A page fails to load or save: check the network, select Refresh once, capture the complete error and the module/record involved, then report it to the LMTS administrator.'
    ]
  }
]

export function UserManualPage() {
  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="User Manual"
          subtitle="Step-by-step workflows and system business logic"
          icon={<BookOpen size={18} />}
        />
        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
          <div
            className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8"
            style={{ color: 'var(--text-primary)' }}
          >
            <section
              className="rounded-xl border p-5"
              style={{
                background: 'var(--glass-bg)',
                borderColor: 'var(--border-default)'
              }}
            >
              <h2 className="text-base font-semibold">Welcome to Candon LMTS</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                This manual documents the end-to-end LMTS workflows: account provisioning and
                permissions, council setup, records, contributor matching, notifications, and
                troubleshooting. Follow the steps in order; available actions depend on your role
                and permissions.
              </p>
              <nav aria-label="Manual sections" className="mt-4 flex flex-wrap gap-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-[var(--accent-primary)]"
                    style={{
                      borderColor: 'var(--border-default)',
                      color: 'var(--accent-primary)'
                    }}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </section>

            {sections.map((section) => {
              const Icon = section.icon
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-4 rounded-xl border p-5"
                  style={{
                    background: 'var(--glass-bg)',
                    borderColor: 'var(--border-default)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={17} style={{ color: 'var(--accent-primary)' }} />
                    <h2 className="text-base font-semibold">{section.title}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                    {section.intro}
                  </p>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
                    {section.steps.map((step) => (
                      <li key={step} style={{ color: 'var(--text-primary)' }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </section>
              )
            })}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Keep account credentials private. Contact your LMTS administrator for access changes or
              issues that cannot be resolved using this guide.
            </p>
          </div>
        </div>
      </PageContainer>
    </Layout>
  )
}

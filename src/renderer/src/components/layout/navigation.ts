import {
  Archive,
  AudioLines,
  BookOpen,
  Bike,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  FileEdit,
  Forward,
  GitMerge,
  Handshake,
  Landmark,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Mic,
  Network,
  NotebookPen,
  Scroll,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Privilege needed to see the module (Admins see everything). */
  privilege?: string
}

export interface NavGroup {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

/** A single ungrouped item, or a collapsible group — the sidebar in top-to-bottom order. */
export type NavEntry = NavItem | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

const DRAFTS = 'Draft Ordinance/s and Draft Resolutions'

export const navEntries: NavEntry[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    title: 'Archive',
    icon: Archive,
    items: [
      { path: '/ordinances', label: 'Ordinances', icon: ScrollText, privilege: 'Ordinances' },
      { path: '/resolutions', label: 'Resolutions', icon: FileCheck, privilege: 'Resolutions' }
    ]
  },
  {
    title: 'Sessions',
    icon: CalendarDays,
    items: [
      {
        path: '/minutes',
        label: 'Order of Business',
        icon: BookOpen,
        // privilege keys are stored names (database rules + saved privileges); only the label changed
        privilege: 'Calendar of Business'
      },
      {
        path: '/session-minutes',
        label: 'Session Minutes',
        icon: NotebookPen,
        privilege: 'Session Minutes'
      },
      {
        path: '/transcript',
        label: 'Transcript',
        icon: Mic,
        privilege: 'Transcript of Proceedings'
      },
      { path: '/other-matters', label: 'Other Matters', icon: Scroll, privilege: 'Other Matters' }
    ]
  },
  {
    title: 'Committees',
    icon: Handshake,
    items: [
      {
        path: '/committee-referrals',
        label: 'Committee Referrals',
        icon: Forward,
        privilege: 'Committee Referrals'
      },
      {
        path: '/committee-reports',
        label: 'Committee Reports & Minutes',
        icon: ClipboardList,
        privilege: 'Committee Reports'
      },
      {
        path: '/committee-transcripts',
        label: 'Hearing/Meeting Transcripts',
        icon: AudioLines,
        privilege: 'Committee Transcripts'
      },
      {
        path: '/public-hearing-minutes',
        label: 'Public Hearing Minutes',
        icon: Megaphone,
        privilege: 'Public Hearing Minutes'
      },
      {
        path: '/committees',
        label: 'Standing Committees',
        icon: UsersRound,
        privilege: 'Standing Committees'
      }
    ]
  },
  {
    title: 'Draft Documents',
    icon: FileEdit,
    items: [
      { path: '/draft-ordinances', label: 'Draft Ordinances', icon: FileEdit, privilege: DRAFTS },
      { path: '/draft-resolutions', label: 'Draft Resolutions', icon: FileEdit, privilege: DRAFTS }
    ]
  },
  {
    path: '/communications',
    label: 'Communications',
    icon: MessageSquare,
    // privilege keys are stored names (database rules + saved privileges); only the label changed
    privilege: 'Other Communications'
  },
  {
    title: 'Barangay & Franchise',
    icon: Building2,
    items: [
      {
        path: '/barangay',
        label: 'Barangay Actions',
        icon: Building2,
        privilege: 'Barangay Actions'
      },
      { path: '/review', label: 'Barangay Review', icon: GitMerge, privilege: 'Barangay Review' },
      {
        path: '/tricycle',
        label: 'Tricycle Franchise',
        icon: Bike,
        privilege: 'Tricycle Franchise'
      }
    ]
  },
  {
    title: 'City Councils',
    icon: Landmark,
    items: [
      { path: '/officials', label: 'Officials', icon: Users, privilege: 'S.P Members' },
      { path: '/org-chart', label: 'Organization Chart', icon: Network, privilege: 'S.P Members' },
      { path: '/terms', label: 'Terms', icon: CalendarRange, privilege: 'S.P Members' }
    ]
  },
  {
    title: 'Administration',
    icon: ShieldCheck,
    items: [
      {
        path: '/accounts',
        label: 'Account Management',
        icon: UserCog,
        privilege: 'Account Management'
      },
      { path: '/user-manual', label: 'User Manual', icon: BookOpen },
      { path: '/logs', label: 'Activity Log', icon: ClipboardCheck }
    ]
  }
]

/** Every routable page (including ones hidden from the sidebar) → its label and group. */
export const PAGE_TITLES: Record<string, { label: string; group?: string }> = Object.fromEntries(
  navEntries.flatMap((entry) =>
    isNavGroup(entry)
      ? entry.items.map((i) => [i.path, { label: i.label, group: entry.title }])
      : [[entry.path, { label: entry.label }]]
  )
)

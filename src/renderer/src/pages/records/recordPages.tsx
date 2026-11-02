import { AudioLines, Forward, Megaphone, NotebookPen } from 'lucide-react'
import { RecordsPage, type RecordsConfig } from './RecordsPage'

/**
 * Document modules from the existing Candon LMTS menu (Sessions and Committees groups). Each table,
 * its columns and its privilege are in supabase/migrations/20261028090000_committee_and_minutes_modules.sql.
 */

const SESSION_TYPES = ['Regular Session', 'Special Session']
const COMMITTEE_SITTINGS = ['Hearing', 'Meeting']

const sessionMinutes: RecordsConfig = {
  table: 'session_minutes',
  folder: 'SessionMinutes',
  title: 'Session Minutes',
  subtitle: 'Minutes of regular and special sessions',
  icon: <NotebookPen size={20} />,
  noun: 'Session Minutes',
  nameField: 'sessionNo',
  dateField: 'date',
  fileRequired: false,
  tabs: { field: 'category', options: SESSION_TYPES },
  fields: [
    {
      key: 'sessionNo',
      label: 'Session Number',
      required: true,
      // The minutes are of that session, so its type, term and date carry over
      kind: 'session',
      fills: { category: 'category', termId: 'termId', date: 'date' },
      column: { width: 'w-40' }
    },
    {
      key: 'category',
      label: 'Session Type',
      kind: 'select',
      options: SESSION_TYPES,
      column: false
    },
    { key: 'termId', label: 'Term', kind: 'term' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'tag', label: 'Tag', placeholder: 'Keywords/tags', wide: true }
  ]
}

const committeeReferrals: RecordsConfig = {
  table: 'committee_referrals',
  folder: 'CommitteeReferrals',
  title: 'Committee Referrals',
  subtitle: 'Draft measures referred to the committees, with their recommendation',
  icon: <Forward size={20} />,
  noun: 'Committee Referral',
  nameField: 'draftCode',
  dateField: 'createdAt',
  fileRequired: false,
  attachments: false,
  // As in the existing Candon LMTS: the draft, then the committee's recommendation and findings
  fields: [
    {
      key: 'draftCode',
      label: 'Draft Code',
      required: true,
      // Searches Draft Ordinances, Draft Resolutions, and Communications together — whichever
      // measure or communication was actually referred — and stores its own code.
      kind: 'draftReference',
      column: { width: 'w-44' }
    },
    {
      key: 'title',
      label: 'Short Title',
      required: true,
      kind: 'textarea',
      placeholder: 'e.g. Lot Reclassification - San Nicolas'
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      kind: 'textarea',
      wide: true,
      emptyText: 'For Committee Recommendation'
    },
    { key: 'findings', label: 'Findings', kind: 'textarea', wide: true, placeholder: 'Findings' },
    { key: 'remarks', label: 'Remarks', kind: 'textarea', wide: true, placeholder: 'Remarks' }
  ]
}

const committeeTranscripts: RecordsConfig = {
  table: 'committee_transcripts',
  folder: 'CommitteeTranscripts',
  title: 'Committee Hearing/Meeting Transcripts',
  subtitle: 'Transcripts of committee hearings and meetings',
  icon: <AudioLines size={20} />,
  noun: 'Committee Transcript',
  nameField: 'title',
  dateField: 'date',
  fileRequired: false,
  tabs: { field: 'category', options: COMMITTEE_SITTINGS },
  fields: [
    { key: 'title', label: 'Title / Subject', required: true, kind: 'textarea', wide: true },
    {
      key: 'committee',
      label: 'Committee',
      kind: 'committee',
      wide: true,
      column: { width: 'w-72' }
    },
    {
      key: 'category',
      label: 'Hearing or Meeting',
      kind: 'select',
      options: COMMITTEE_SITTINGS,
      column: false
    },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'tag', label: 'Tag', placeholder: 'Keywords/tags', column: false }
  ]
}

const publicHearingMinutes: RecordsConfig = {
  table: 'public_hearing_minutes',
  folder: 'PublicHearingMinutes',
  title: 'Public Hearing Minutes',
  subtitle: 'Minutes of public hearings',
  icon: <Megaphone size={20} />,
  noun: 'Public Hearing Minutes',
  nameField: 'title',
  dateField: 'date',
  fileRequired: false,
  fields: [
    {
      key: 'title',
      label: 'Title / Subject',
      required: true,
      kind: 'textarea',
      wide: true,
      placeholder: 'Measure or matter heard'
    },
    {
      key: 'committee',
      label: 'Committee',
      kind: 'committee',
      wide: true,
      column: { width: 'w-72' }
    },
    { key: 'termId', label: 'Term', kind: 'term' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'tag', label: 'Tag', placeholder: 'Keywords/tags', wide: true, column: false }
  ]
}

export function SessionMinutesPage() {
  return <RecordsPage config={sessionMinutes} />
}

export function CommitteeReferralsPage() {
  return <RecordsPage config={committeeReferrals} />
}

export function CommitteeTranscriptsPage() {
  return <RecordsPage config={committeeTranscripts} />
}

export function PublicHearingMinutesPage() {
  return <RecordsPage config={publicHearingMinutes} />
}

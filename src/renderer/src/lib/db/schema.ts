/**
 * Column registry for the Candon LMTS Supabase schema
 * (candon-lmts-admin/supabase/migrations/20261028000000_init.sql).
 *
 * The same file exists in candon-lmts-admin and candon-app — keep both in sync with the
 * migrations. App fields that have no column here are stored in the `extra` jsonb
 * column, so writes never fail on an unknown field.
 */

export const TABLE_COLUMNS = {
  ordinances: [
    'ordinance_number',
    'category',
    'title',
    'author',
    'tag',
    'date_approved_sp',
    'action_sp',
    'transmitted_date_mayor',
    'action_mayor',
    'transmitted_date_sp',
    'action_tsp',
    'date_received',
    'posting_date',
    'publication_date',
    'created',
    'updated',
    'size',
    'file_path',
    'file_type',
    'code_sort_key'
  ],
  resolutions: [
    'resolution_number',
    'category',
    'title',
    'author',
    'tag',
    'date_approved_sp',
    'action_sp',
    'transmitted_date_mayor',
    'action_mayor',
    'transmitted_date_sp',
    'action_tsp',
    'date_received',
    'posting_date',
    'publication_date',
    'created',
    'updated',
    'file_path',
    'file_type',
    'code_sort_key'
  ],
  draft_ordinances: [
    'draft_ordinance_number',
    'title',
    'author',
    'co_author',
    'sponsor',
    'session_no',
    'tag',
    'reading',
    'status',
    'action_committee',
    'action_referred',
    'date_of_reading',
    'time_of_reading',
    'file_path',
    'file_type'
  ],
  draft_resolutions: [
    'draft_resolution_number',
    'title',
    'author',
    'co_author',
    'sponsor',
    'tag',
    'session_no',
    'reading',
    'status',
    'action_of_officer',
    'date_received',
    'date_of_reading',
    'time_received',
    'file_path',
    'file_type'
  ],
  draft_ordinance_readings: ['draft_no', 'session_no', 'reading'],
  draft_resolution_readings: ['draft_no', 'session_no', 'reading'],
  minutes: [
    'session_no',
    'date',
    'category',
    'time',
    'call_order',
    'place',
    'agenda',
    'tag',
    'adjournment_time',
    'prayer',
    'present',
    'absent',
    'file_path',
    'file_type',
    'term_id'
  ],
  transcripts: [
    'session_no',
    'session_category',
    'previous_session_no',
    'date_of_previous_session',
    'transcript_no',
    'transcript_category',
    'tag',
    'file_path',
    'file_type'
  ],
  communications: [
    'communication_no',
    'title',
    'author',
    'co_author',
    'sponsor',
    'source',
    'session_no',
    'status',
    'tag',
    'date_received',
    'time_received',
    'file_path',
    'file_type'
  ],
  brgy_actions: [
    'brgy',
    'category',
    'measures_no',
    'measures_title',
    'resolution_number',
    'action',
    'tag',
    'date_approved',
    'date_received',
    'time_received',
    'date_released',
    'time_released',
    'file_path',
    'file_type',
    'code_sort_key'
  ],
  brgy_reviews: [
    'review_no',
    'title',
    'description',
    'district_councilor',
    'session_no',
    'tag',
    'date_received',
    'time_received',
    'category',
    'file_path',
    'file_type'
  ],
  committees: ['title', 'description', 'chairman', 'vice_chairman', 'members', 'term_id'],
  committee_reports: [
    'committee_reports_no',
    'committee',
    'title',
    'measures',
    'session_no',
    'tag',
    'date_received',
    'time_received',
    'file_path',
    'file_type',
    'report_type'
  ],
  other_matters: [
    'other_matters_no',
    'title',
    'session_no',
    'date_received',
    'time_received',
    'status',
    'author',
    'tag',
    'file_path',
    'file_type'
  ],
  tricycle_franchises: [
    'name',
    'address',
    'make',
    'motor_no',
    'chassis_no',
    'plate_no',
    'franchise_no',
    'ordinance_number',
    'expiration',
    'date_received',
    'time_received',
    'nature_of_franchise',
    'category',
    'action',
    'file_path',
    'file_type',
    'code_sort_key'
  ],
  session_minutes: ['session_no', 'category', 'date', 'tag', 'term_id', 'file_path', 'file_type'],
  committee_referrals: [
    'draft_code',
    'title',
    'recommendation',
    'findings',
    'remarks',
    'file_path',
    'file_type'
  ],
  committee_transcripts: [
    'title',
    'committee',
    'category',
    'date',
    'tag',
    'term_id',
    'file_path',
    'file_type'
  ],
  public_hearing_minutes: [
    'title',
    'committee',
    'date',
    'tag',
    'term_id',
    'file_path',
    'file_type'
  ],
  terms: ['name', 'start_date', 'end_date', 'remarks'],
  officials: [
    'first_name',
    'middle_name',
    'last_name',
    'suffix',
    'position',
    'reports_to_id',
    'file_path',
    'term_id',
    'title'
  ],
  activity_logs: ['name', 'activity', 'date', 'year'],
  users: [
    'username',
    'email',
    'official_id',
    'role',
    'privileges',
    'first_name',
    'middle_name',
    'last_name',
    'suffix',
    'contact_number',
    'birthday',
    'gender',
    'address',
    'file_path'
  ]
} as const

export type TableName = keyof typeof TABLE_COLUMNS

/** Columns every table has, besides its own. */
export const COMMON_COLUMNS = ['id', 'extra', 'created_at', 'updated_at'] as const

/** App fields whose generic camelCase → snake_case form would read badly. */
export const FIELD_COLUMN_OVERRIDES: Record<string, string> = {
  iONumber: 'io_number',
  transmittedDateSP: 'transmitted_date_sp',
  actionTSp: 'action_tsp'
}

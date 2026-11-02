/**
 * Data access for LMTS Admin, backed by Supabase (Postgres + Storage).
 *
 * Pages work with camelCase records exactly as before; this module maps them to the
 * snake_case columns in supabase/migrations and back. Fields without a column of their own
 * round-trip through each table's `extra` jsonb column.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { notifySessionExpired } from '../session'
import { DOCUMENTS_BUCKET, supabase } from '../supabase'
import { computeCodeSortKey } from '../utils'
import { COMMON_COLUMNS, FIELD_COLUMN_OVERRIDES, TABLE_COLUMNS, type TableName } from './schema'

export type { TableName }

type Row = Record<string, unknown>

export type FilterOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'

export interface FetchFilter {
  field: string
  op: FilterOp
  value: unknown
}

export interface FetchResult<T> {
  items: (T & { id: string })[]
  /** Offset of the next page, or null when there is nothing more to load. */
  nextOffset: number | null
  hasMore: boolean
}

/** PostgREST's default cap on rows per request. */
const MAX_ROWS = 1000

const commonColumns = new Set<string>(COMMON_COLUMNS)
const tableColumns = Object.fromEntries(
  Object.entries(TABLE_COLUMNS).map(([table, columns]) => [table, new Set<string>(columns)])
) as Record<TableName, Set<string>>
const columnFieldOverrides = Object.fromEntries(
  Object.entries(FIELD_COLUMN_OVERRIDES).map(([field, column]) => [column, field])
)

// ── Field ↔ column mapping ───────────────────────────────────────────────────

export function fieldToColumn(field: string): string {
  return FIELD_COLUMN_OVERRIDES[field] ?? field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function columnToField(column: string): string {
  return (
    columnFieldOverrides[column] ??
    column.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  )
}

/** Column to filter/sort on for an app field — or its JSON path when it lives in `extra`. */
function queryColumn(table: TableName, field: string): string {
  const column = fieldToColumn(field)
  return tableColumns[table].has(column) || commonColumns.has(column) ? column : `extra->>${field}`
}

/** Database row → app record. Null columns are left out, like a missing Firestore field. */
export function fromRow<T = Row>(row: Row): T & { id: string } {
  const { extra, ...columns } = row
  const record: Row = { ...(extra && typeof extra === 'object' ? (extra as Row) : {}) }
  for (const [column, value] of Object.entries(columns)) {
    if (value !== null) record[columnToField(column)] = value
  }
  return record as T & { id: string }
}

/** App record → columns + leftover fields for `extra`. id and timestamps belong to the database. */
function toRow(table: TableName, data: Row): { row: Row; extra: Row } {
  const row: Row = {}
  const extra: Row = {}
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) continue
    const column = fieldToColumn(field)
    if (commonColumns.has(column)) continue
    if (tableColumns[table].has(column)) row[column] = value
    else extra[field] = value
  }
  return { row, extra }
}

function prepareDocumentData(data: Row): Row {
  if (typeof data.ordinanceNumber === 'string') {
    return { ...data, codeSortKey: computeCodeSortKey(data.ordinanceNumber) }
  }
  if (typeof data.resolutionNumber === 'string') {
    return { ...data, codeSortKey: computeCodeSortKey(data.resolutionNumber) }
  }
  return data
}

// ── Errors ───────────────────────────────────────────────────────────────────

const NO_PERMISSION = "You don't have permission to change this record."

function toError(error: PostgrestError | { message: string; code?: string }): Error {
  if (error.code === '42501') return new Error(NO_PERMISSION)
  if (error.code === 'PGRST301' || error.code === 'PGRST303') {
    notifySessionExpired()
    return new Error('Your session has expired — please sign in again.')
  }
  if (/failed to fetch|network/i.test(error.message)) {
    return new Error('Cannot reach the server. Please check your connection.')
  }
  return new Error(error.message)
}

const NOTIFIABLE_TABLES = new Set<TableName>([
  'ordinances',
  'resolutions',
  'draft_ordinances',
  'draft_resolutions',
  'communications',
  'minutes',
  'session_minutes',
  'transcripts',
  'other_matters',
  'committee_referrals',
  'committee_reports',
  'committee_transcripts',
  'public_hearing_minutes',
  'committees',
  'brgy_actions',
  'brgy_reviews',
  'tricycle_franchises',
  'officials',
  'terms'
])

function getNotificationSummary(data: Row): string {
  const fields = [
    'title',
    'ordinanceNumber',
    'ordinance_number',
    'resolutionNumber',
    'resolution_number',
    'draftOrdinanceNumber',
    'draft_ordinance_number',
    'draftResolutionNumber',
    'draft_resolution_number',
    'communicationNo',
    'communication_no',
    'sessionNo',
    'session_no',
    'measuresTitle',
    'measures_title',
    'reviewNo',
    'review_no',
    'committeeReportsNo',
    'committee_reports_no',
    'name'
  ]
  for (const field of fields) {
    const value = data[field]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 180)
  }
  return ''
}

async function notifyMobileUsers(
  table: TableName,
  action: 'created' | 'updated' | 'deleted',
  recordId: string,
  data: Row,
  hasFile: boolean
): Promise<void> {
  if (!NOTIFIABLE_TABLES.has(table)) return

  const body = {
    table,
    action,
    recordId,
    eventId: crypto.randomUUID(),
    summary: getNotificationSummary(data),
    source:
      typeof data.source === 'string'
        ? data.source
        : data.extra && typeof data.extra === 'object'
          ? (data.extra as Row).source
          : undefined,
    hasFile
  }
  const invoke = (accessToken?: string) =>
    supabase.functions.invoke('notify-users', {
      body,
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {})
    })
  let invocation = await invoke()

  if (invocation.error) {
    const status =
      invocation.error.context instanceof Response ? invocation.error.context.status : undefined
    if (status === 401) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshed.session) {
        invocation = await invoke(refreshed.session.access_token)
      } else {
        const reason = refreshError?.message ?? 'No valid session is available.'
        console.error('[mobile notification session refresh failed]', {
          table,
          action,
          recordId,
          reason
        })
        toast.warning(
          `Record saved, but user notifications could not be sent: Could not refresh the sign-in session (${reason}).`
        )
        return
      }
    } else if (status === undefined || [408, 429, 500, 502, 503, 504].includes(status)) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      invocation = await invoke()
    }
  }

  const { data: result, error } = invocation
  if (error || result?.error) {
    let message = result?.error ? String(result.error) : (error?.message ?? 'Unknown error')
    if (error?.context instanceof Response) {
      const responseBody = await error.context.clone().text()
      if (responseBody) {
        try {
          const parsed = JSON.parse(responseBody) as { error?: unknown; message?: unknown }
          message =
            typeof parsed.error === 'string'
              ? parsed.error
              : typeof parsed.message === 'string'
                ? parsed.message
                : `HTTP ${error.context.status}: ${responseBody}`
        } catch {
          message = `HTTP ${error.context.status}: ${responseBody}`
        }
      } else {
        message = `HTTP ${error.context.status}: ${message}`
      }
    }
    console.error('[mobile notification error]', {
      table,
      action,
      recordId,
      message
    })
    toast.warning(`Record saved, but user notifications could not be sent: ${message}`)
    return
  }
  if (result?.recipientCount === 0) {
    toast.warning('Record saved, but no other active mobile users have view access to this module.')
    return
  }
  if (result?.deviceCount === 0) {
    toast.warning(
      'Record saved and added to eligible users’ app inboxes, but no push-enabled mobile devices are registered.'
    )
    return
  }
  if (typeof result?.pushFailed === 'number' && result.pushFailed > 0) {
    toast.warning(
      `The notification was saved in the app inbox, but push delivery failed for ${result.pushFailed} device(s).`
    )
  }
}
// ── Search (client-side, same rules as before) ───────────────────────────────

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchText(data: Row): string {
  return normalizeSearchText(
    Object.values(data)
      .map((value) => {
        if (value == null) return ''
        if (typeof value === 'string') return value
        if (typeof value === 'number' || typeof value === 'boolean') return String(value)
        return JSON.stringify(value)
      })
      .join(' ')
  )
}

// ── Queries ──────────────────────────────────────────────────────────────────

type SelectQuery = ReturnType<ReturnType<typeof supabase.from>['select']>

function applyFilters(query: SelectQuery, table: TableName, filters: FetchFilter[]): SelectQuery {
  let q = query
  for (const f of filters) {
    const column = queryColumn(table, f.field)
    switch (f.op) {
      case '==':
        q = q.eq(column, f.value)
        break
      case '!=':
        q = q.neq(column, f.value)
        break
      case '<':
        q = q.lt(column, f.value)
        break
      case '<=':
        q = q.lte(column, f.value)
        break
      case '>':
        q = q.gt(column, f.value)
        break
      case '>=':
        q = q.gte(column, f.value)
        break
      case 'in':
        q = q.in(column, Array.isArray(f.value) ? f.value : [f.value])
        break
      case 'array-contains':
        q = q.contains(column, [f.value])
        break
    }
  }
  return q
}

/** Runs `page(from, to)` until a short page comes back, so "fetch all" isn't capped at 1000 rows. */
async function fetchAllRows(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += MAX_ROWS) {
    const { data, error } = await page(from, from + MAX_ROWS - 1)
    if (error) throw toError(error)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < MAX_ROWS) return rows
  }
}

export async function fetchDocs<T>(
  table: TableName,
  opts: {
    orderByField: string
    direction?: 'asc' | 'desc'
    /** Omit to fetch every matching record. */
    pageSize?: number
    offset?: number
    filters?: FetchFilter[]
    searchQuery?: string
  }
): Promise<FetchResult<T>> {
  const { orderByField, direction = 'desc', pageSize, offset = 0, filters = [], searchQuery } = opts
  const normalizedSearch = normalizeSearchText(searchQuery)

  const page = (from: number, to: number) =>
    applyFilters(supabase.from(table).select('*'), table, filters)
      .order(queryColumn(table, orderByField), {
        ascending: direction === 'asc',
        nullsFirst: false
      })
      .order('id', { ascending: true }) // stable tie-break so pages never overlap
      .range(from, to)

  let rows: Row[]
  if (pageSize) {
    const { data, error } = await page(offset, offset + pageSize - 1)
    if (error) throw toError(error)
    rows = (data ?? []) as Row[]
  } else {
    rows = await fetchAllRows(page)
  }

  let items = rows.map((row) => fromRow<T>(row))
  // Search runs on the live fields of the fetched records, as it did before.
  if (normalizedSearch) {
    items = items.filter((item) => buildSearchText(item as Row).includes(normalizedSearch))
  }

  const hasMore = !!pageSize && rows.length >= pageSize
  return { items, nextOffset: hasMore ? offset + rows.length : null, hasMore }
}

export async function queryDocuments<T>(
  table: TableName,
  field: string,
  value: string
): Promise<(T & { id: string })[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(queryColumn(table, field), value)
  if (error) throw toError(error)
  return (data ?? []).map((row) => fromRow<T>(row as Row))
}

export async function countDocs(
  table: TableName,
  opts?: { filters?: FetchFilter[] }
): Promise<number> {
  const { count, error } = await applyFilters(
    supabase.from(table).select('id', { count: 'exact', head: true }),
    table,
    opts?.filters ?? []
  )
  if (error) throw toError(error)
  return count ?? 0
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function addDocument(table: TableName, data: Row): Promise<string> {
  const { row, extra } = toRow(table, prepareDocumentData(data))
  if (Object.keys(extra).length) row.extra = extra
  const { data: inserted, error } = await supabase.from(table).insert(row).select('id').single()
  if (error) throw toError(error)
  const id = String(inserted.id)
  await notifyMobileUsers(table, 'created', id, data, Boolean(data.filePath || data.file_path))
  return id
}

export async function updateDocument(table: TableName, id: string, data: Row): Promise<void> {
  const { row, extra } = toRow(table, prepareDocumentData(data))
  const hasFileColumn = tableColumns[table].has('file_path')
  let current: Row | null = null
  if (Object.keys(extra).length || hasFileColumn) {
    const columns = [
      ...(Object.keys(extra).length ? ['extra'] : []),
      ...(hasFileColumn ? ['file_path'] : [])
    ].join(',')
    const { data: existing, error } = await supabase
      .from(table)
      .select(columns)
      .eq('id', id)
      .maybeSingle()
    if (error) throw toError(error)
    current = existing as Row | null
  }
  if (Object.keys(extra).length) {
    // Merge into the stored extra fields, like a Firestore field update would.
    row.extra = { ...((current?.extra as Row | undefined) ?? {}), ...extra }
  }
  const { data: updated, error } = await supabase.from(table).update(row).eq('id', id).select('id')
  if (error) throw toError(error)
  // Row level security hides blocked rows instead of erroring, so check something changed.
  if (!updated?.length) throw new Error(`Not saved. ${NO_PERMISSION} (or it was deleted)`)
  const oldPath = typeof current?.file_path === 'string' ? current.file_path : ''
  const newPath =
    typeof data.filePath === 'string'
      ? data.filePath
      : typeof data.file_path === 'string'
        ? data.file_path
        : oldPath
  await notifyMobileUsers(table, 'updated', id, data, Boolean(newPath && newPath !== oldPath))
}

export async function deleteDocument(table: TableName, id: string): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (existingError) throw toError(existingError)
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error) throw toError(error)
  if (!data?.length) throw new Error(`Not deleted. ${NO_PERMISSION} (or it was already deleted)`)
  await notifyMobileUsers(table, 'deleted', id, (existing as Row | null) ?? {}, false)
}

/** Insert, or update in place when `conflictFields` already match a row (e.g. a per-session
 *  history snapshot that should accumulate rather than duplicate on repeat saves). */
export async function upsertDocument(
  table: TableName,
  data: Row,
  conflictFields: string[]
): Promise<void> {
  const { row, extra } = toRow(table, prepareDocumentData(data))
  if (Object.keys(extra).length) row.extra = extra
  const onConflict = conflictFields.map(fieldToColumn).join(',')
  const { error } = await supabase.from(table).upsert(row, { onConflict })
  if (error) throw toError(error)
}

/** Deletes every row where `field` equals `value` — e.g. clearing a deleted draft's reading
 *  history, which spans one row per session rather than a single id. */
export async function deleteDocumentsWhere(
  table: TableName,
  field: string,
  value: unknown
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq(fieldToColumn(field), value)
  if (error) throw toError(error)
}

// ── Files ────────────────────────────────────────────────────────────────────

const isExternalUrl = (path: string) => /^https?:\/\//i.test(path)

function getUniqueStorageFilename(filename: string, file: File): string {
  const ext = file.name.split('.').pop() ?? ''
  const safeBase = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_')
  const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return ext ? `${safeBase}_${uniqueSuffix}.${ext}` : `${safeBase}_${uniqueSuffix}`
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image compression is unavailable in this browser')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('Could not compress the selected image')),
        'image/webp',
        0.82
      )
    })
    if (blob.type !== 'image/webp') {
      throw new Error('This browser cannot encode compressed WebP images')
    }

    const name = `${file.name.replace(/\.[^.]+$/, '')}.webp`
    return new File([blob], name, { type: 'image/webp', lastModified: file.lastModified })
  } finally {
    image.close()
  }
}

/** Uploads into the documents bucket and returns the stored path (what records keep in filePath). */
export async function uploadFile(folder: string, filename: string, file: File): Promise<string> {
  const preparedFile = await compressImageFile(file)
  const path = `${folder}/${getUniqueStorageFilename(filename, preparedFile)}`
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, preparedFile, { contentType: preparedFile.type || undefined, upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

export async function removeStoredFile(path: string): Promise<void> {
  if (!path || isExternalUrl(path)) return
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

/** Short-lived signed URL for a stored file (full URLs are passed through unchanged). */
export async function getFileUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  if (isExternalUrl(path)) return path
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw new Error(`Cannot open the file: ${error.message}`)
  return data.signedUrl
}

/** A stored file's contents (for the in-app viewer and its Download button). */
export async function downloadStoredFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path)
  if (error) throw new Error(`Cannot open the file: ${error.message}`)
  // Chromium only shows a PDF inline when the blob says it is one
  if (/\.pdf$/i.test(path) && data.type !== 'application/pdf') {
    return new Blob([data], { type: 'application/pdf' })
  }
  return data
}

// The in-app viewer (components/ui/FileViewerModal) registers itself here when the app starts.
let fileViewer: ((path: string) => void) | null = null
export function setFileViewer(viewer: ((path: string) => void) | null): void {
  fileViewer = viewer
}

/** Shows a record's file in the in-app viewer (links to other sites open in the browser). */
export async function openStoredFile(path: string | null | undefined): Promise<void> {
  if (!path) {
    toast.error('No file attached')
    return
  }
  if (fileViewer && !isExternalUrl(path)) {
    fileViewer(path)
    return
  }
  try {
    window.open(await getFileUrl(path), '_blank')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Cannot open the file')
  }
}

function fileTypeOf(file: File): string {
  if (file.type.startsWith('image/')) return '.webp'
  return `.${file.name.split('.').pop() ?? ''}`
}

export async function addDocumentWithFile(
  table: TableName,
  data: Row,
  storageFolder: string,
  storageFilename: string,
  file: File | null
): Promise<string> {
  let filePath = ''
  let fileType = ''
  if (file) {
    filePath = await uploadFile(storageFolder, storageFilename, file)
    fileType = fileTypeOf(file)
  }
  try {
    return await addDocument(table, { ...data, filePath, fileType })
  } catch (err) {
    if (filePath) {
      try {
        await removeStoredFile(filePath)
      } catch (cleanupError) {
        const cause = err instanceof Error ? err.message : 'The record could not be saved'
        const cleanup =
          cleanupError instanceof Error ? cleanupError.message : 'unknown storage error'
        throw new Error(`${cause}. Uploaded-file cleanup also failed: ${cleanup}`)
      }
    }
    throw err
  }
}

/** Saves the record and, when a new file is given, swaps it in. Returns the record's file path. */
export async function updateDocumentWithFile(
  table: TableName,
  id: string,
  data: Row,
  storageFolder: string,
  storageFilename: string,
  file: File | null,
  existingFilePath: string,
  existingFileType: string
): Promise<string> {
  if (!file) {
    await updateDocument(table, id, {
      ...data,
      filePath: existingFilePath,
      fileType: existingFileType
    })
    return existingFilePath
  }

  const filePath = await uploadFile(storageFolder, storageFilename, file)
  try {
    await updateDocument(table, id, { ...data, filePath, fileType: fileTypeOf(file) })
  } catch (err) {
    try {
      await removeStoredFile(filePath)
    } catch (cleanupError) {
      const cause = err instanceof Error ? err.message : 'The record could not be updated'
      const cleanup = cleanupError instanceof Error ? cleanupError.message : 'unknown storage error'
      throw new Error(`${cause}. Uploaded-file cleanup also failed: ${cleanup}`)
    }
    throw err
  }
  if (existingFilePath) {
    try {
      await removeStoredFile(existingFilePath)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown storage error'
      throw new Error(`Record updated, but the previous file could not be removed: ${reason}`)
    }
  }
  return filePath
}

export async function deleteDocumentWithFile(table: TableName, id: string): Promise<void> {
  const { data: existing, error } = await supabase
    .from(table)
    .select('file_path')
    .eq('id', id)
    .maybeSingle()
  if (error) throw toError(error)
  await deleteDocument(table, id)
  const filePath = (existing as Row | null)?.file_path
  if (typeof filePath === 'string' && filePath) {
    try {
      await removeStoredFile(filePath)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown storage error'
      throw new Error(`Record deleted, but its file could not be removed: ${reason}`)
    }
  }
}

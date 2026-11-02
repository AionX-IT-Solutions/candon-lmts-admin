import { SearchPickerField } from './SearchPickerField'
import { sessionLabel } from '../../lib/sessions'
import type { Minutes } from '../../types'

interface SessionFieldProps {
  /** The sessionNo currently stored on the record being edited. */
  value: string
  /** Fires only when a real session is clicked — never from typing, so the stored value can
   *  never drift from an actual Order of Business record. `session` is the full picked record,
   *  for callers that also need to copy another of its fields (e.g. Transcript's own session
   *  type) — most callers only need the string. */
  onChange: (sessionNo: string, session?: Minutes) => void
  sessions: Minutes[]
  error?: boolean
  disabled?: boolean
}

/** Session No. field tied to Order of Business — see SearchPickerField.tsx for the shared
 *  "typing filters, clicking commits" mechanics this is built on. */
export function SessionField({ value, onChange, sessions, error, disabled }: SessionFieldProps) {
  return (
    <SearchPickerField<Minutes>
      value={value}
      onChange={onChange}
      items={sessions}
      getKey={(s) => s.id}
      getValue={(s) => s.sessionNo}
      getLabel={sessionLabel}
      getSearchText={(s) => `${sessionLabel(s)} ${s.sessionNo}`}
      placeholder="Select session…"
      searchPlaceholder="Search sessions…"
      emptyMessage="— Add sessions under Sessions → Order of Business —"
      error={error}
      disabled={disabled}
    />
  )
}

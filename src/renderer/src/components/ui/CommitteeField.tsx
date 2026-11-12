import { SearchPickerField } from './SearchPickerField'
import type { Committee } from '../../types'

interface CommitteeFieldProps {
  /** The committee's title currently stored on the record being edited — same "store the name,
   *  not an id" convention RecordsPage.tsx's own committee field already uses. */
  value: string
  /** Fires only when a real committee is clicked — never from typing, so the stored value can
   *  never drift from an actual committee. `committee` is the full picked record, for callers
   *  that also want its chairman/description/etc. — most callers only need the title. */
  onChange: (title: string, committee?: Committee) => void
  committees: Committee[]
  error?: boolean
  disabled?: boolean
}

/** Committee field tied to the Standing Committees registry — see SearchPickerField.tsx for the
 *  shared "typing filters, clicking commits" mechanics this is built on. */
export function CommitteeField({
  value,
  onChange,
  committees,
  error,
  disabled
}: CommitteeFieldProps) {
  return (
    <SearchPickerField<Committee>
      value={value}
      onChange={onChange}
      items={committees}
      getKey={(c) => c.id}
      getValue={(c) => c.title}
      getLabel={(c) => c.title}
      placeholder="Select committee…"
      searchPlaceholder="Search committees…"
      emptyMessage="— Add committees under Committees → Standing Committees —"
      error={error}
      disabled={disabled}
    />
  )
}

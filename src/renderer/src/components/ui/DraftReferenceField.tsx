import { SearchPickerField } from './SearchPickerField'
import { draftReferenceLabel, type DraftReference } from '../../lib/draftReferences'

interface DraftReferenceFieldProps {
  /** The draft/communication code currently stored (e.g. "DO No. 051-2026"). */
  value: string
  onChange: (code: string, reference?: DraftReference) => void
  references: DraftReference[]
  error?: boolean
  disabled?: boolean
}

/** "Draft Code" field for Committee Referrals — searches Draft Ordinances, Draft Resolutions,
 *  and Communications together, however the referred item is labeled, see
 *  SearchPickerField.tsx for the shared "typing filters, clicking commits" mechanics. */
export function DraftReferenceField({
  value,
  onChange,
  references,
  error,
  disabled
}: DraftReferenceFieldProps) {
  return (
    <SearchPickerField<DraftReference>
      value={value}
      onChange={onChange}
      items={references}
      getKey={(r) => r.id}
      getValue={(r) => r.code}
      getLabel={draftReferenceLabel}
      getSearchText={(r) => `${r.code} ${r.title} ${r.sourceLabel}`}
      placeholder="Select draft or communication…"
      searchPlaceholder="Search drafts and communications…"
      emptyMessage="— Add a Draft Ordinance, Draft Resolution, or Communication first —"
      error={error}
      disabled={disabled}
    />
  )
}

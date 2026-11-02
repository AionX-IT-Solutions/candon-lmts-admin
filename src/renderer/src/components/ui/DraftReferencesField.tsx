import { MultiSearchPickerField } from './MultiSearchPickerField'
import { draftReferenceLabel, type DraftReference } from '../../lib/draftReferences'

interface DraftReferencesFieldProps {
  /** Codes currently stored on the record — same "store the code, not an id" convention every
   *  field built on SearchPickerField already uses. */
  values: string[]
  onChange: (values: string[]) => void
  references: DraftReference[]
  error?: boolean
  disabled?: boolean
}

/** Measures field: picks any number of Draft Ordinances/Resolutions/Communications a report
 *  (e.g. a joint committee report's numbered "(1) ... (2) ...") actually acts on. */
export function DraftReferencesField({
  values,
  onChange,
  references,
  error,
  disabled
}: DraftReferencesFieldProps) {
  return (
    <MultiSearchPickerField<DraftReference>
      values={values}
      onChange={onChange}
      items={references}
      getKey={(r) => r.id}
      getValue={(r) => r.code}
      getLabel={draftReferenceLabel}
      placeholder="Select draft ordinances, resolutions or communications…"
      searchPlaceholder="Search…"
      emptyMessage="— Add drafts under Draft Documents, or communications under Communications —"
      error={error}
      disabled={disabled}
    />
  )
}

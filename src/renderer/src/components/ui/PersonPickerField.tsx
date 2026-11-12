import { MultiSearchPickerField } from './MultiSearchPickerField'
import type { PersonOrCommittee } from '../../lib/peopleAndCommittees'

interface PersonPickerFieldProps {
  /** Names currently stored on the record — same "store the name, not an id" convention every
   *  field built on SearchPickerField already uses. */
  values: string[]
  onChange: (values: string[]) => void
  people: PersonOrCommittee[]
  error?: boolean
  disabled?: boolean
}

/** Author / Co-Author / Sponsor field: picks any number of officials and/or committees. */
export function PersonPickerField({
  values,
  onChange,
  people,
  error,
  disabled
}: PersonPickerFieldProps) {
  return (
    <MultiSearchPickerField<PersonOrCommittee>
      values={values}
      onChange={onChange}
      items={people}
      getKey={(p) => p.id}
      getValue={(p) => p.name}
      getLabel={(p) => `${p.name} · ${p.sourceLabel}`}
      placeholder="Select officials or committees…"
      searchPlaceholder="Search officials or committees…"
      emptyMessage="— Add officials under City Councils → Officials, or committees under Committees → Standing Committees —"
      error={error}
      disabled={disabled}
    />
  )
}

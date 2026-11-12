import { MultiSearchPickerField } from './MultiSearchPickerField'
import { officialName } from '../../lib/orgChart'
import type { Official } from '../../types'

interface OfficialsPickerFieldProps {
  /** Names currently stored on the record — same "store the name, not an id" convention every
   *  field built on SearchPickerField already uses. */
  values: string[]
  onChange: (values: string[]) => void
  officials: Official[]
  placeholder?: string
  error?: boolean
  disabled?: boolean
}

/** Roll Call Present/Absent: picks any number of officials by name. */
export function OfficialsPickerField({
  values,
  onChange,
  officials,
  placeholder = 'Select officials…',
  error,
  disabled
}: OfficialsPickerFieldProps) {
  return (
    <MultiSearchPickerField<Official>
      values={values}
      onChange={onChange}
      items={officials}
      getKey={(o) => o.id}
      getValue={officialName}
      getLabel={(o) => `${officialName(o)} · ${o.position}`}
      placeholder={placeholder}
      searchPlaceholder="Search officials…"
      emptyMessage="— Add officials under City Councils → Officials —"
      error={error}
      disabled={disabled}
    />
  )
}

/** S.P positions, highest first — also the order officials appear in the organization chart. */
export const POSITIONS = [
  { value: 'City Vice Mayor', label: 'City Vice Mayor' },
  { value: 'City Councilor', label: 'City Councilor' },
  { value: 'Ex-Officio', label: 'Ex-Officio' }
]

export function positionRank(position: string | undefined): number {
  const index = POSITIONS.findIndex((p) => p.value === position)
  return index === -1 ? POSITIONS.length : index
}

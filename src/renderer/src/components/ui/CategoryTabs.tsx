/** Segmented category switcher for table toolbars (GSPIS style). */
export function CategoryTabs({
  options,
  value,
  onChange
}: {
  options: readonly string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: 3,
        gap: 3
      }}
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              background: active ? 'var(--accent-primary)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              boxShadow: active ? '0 2px 10px var(--accent-primary-glow)' : 'none'
            }}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

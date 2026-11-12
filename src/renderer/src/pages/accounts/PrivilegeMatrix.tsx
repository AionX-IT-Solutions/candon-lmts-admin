import {
  ACTION_LABELS,
  PRIVILEGE_ACTIONS,
  PRIVILEGE_MODULES,
  privilegeKey,
  type PrivilegeAction
} from '../../lib/permissions'

type ModuleEntry = (typeof PRIVILEGE_MODULES)[number]

/**
 * Privileges as a module × action grid (View / Add / Edit / Delete). Ticking Add, Edit or Delete
 * ticks View too, and clearing View clears the rest: a module can't be changed without seeing it.
 */
export function PrivilegeMatrix({
  value,
  onChange,
  viewOnly = false
}: {
  value: string[]
  onChange: (privileges: string[]) => void
  /** The View Only role: only the View column can be ticked */
  viewOnly?: boolean
}) {
  const has = (module: string, action: PrivilegeAction) =>
    value.includes(privilegeKey(module, action))
  const usable = (action: PrivilegeAction) => !viewOnly || action === 'view'

  function setCell(next: Set<string>, entry: ModuleEntry, action: PrivilegeAction, on: boolean) {
    if (!entry.actions.includes(action)) return
    if (on) {
      next.add(privilegeKey(entry.module, action))
      next.add(privilegeKey(entry.module, 'view'))
    } else if (action === 'view') {
      for (const a of entry.actions) next.delete(privilegeKey(entry.module, a))
    } else {
      next.delete(privilegeKey(entry.module, action))
    }
  }

  function apply(cells: [ModuleEntry, PrivilegeAction][], on: boolean) {
    const next = new Set(value)
    for (const [entry, action] of cells) setCell(next, entry, action, on)
    onChange([...next])
  }

  const columnCells = (action: PrivilegeAction): [ModuleEntry, PrivilegeAction][] =>
    PRIVILEGE_MODULES.filter((m) => m.actions.includes(action)).map((m) => [m, action])
  const rowCells = (entry: ModuleEntry): [ModuleEntry, PrivilegeAction][] =>
    entry.actions.filter(usable).map((a) => [entry, a])
  const allTicked = (cells: [ModuleEntry, PrivilegeAction][]) =>
    cells.length > 0 && cells.every(([entry, action]) => has(entry.module, action))

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="text-left pb-2">
            <span className="label">Module</span>
          </th>
          {PRIVILEGE_ACTIONS.map((action) => (
            <th key={action} className="w-20 pb-2">
              <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                <span className="label">{ACTION_LABELS[action]}</span>
                <input
                  type="checkbox"
                  aria-label={`${ACTION_LABELS[action]}: all modules`}
                  checked={allTicked(columnCells(action))}
                  disabled={!usable(action)}
                  onChange={(e) => apply(columnCells(action), e.target.checked)}
                  className="rounded accent-blue-600"
                />
              </label>
            </th>
          ))}
          <th className="w-14 pb-2 align-top">
            <span className="label">All</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {PRIVILEGE_MODULES.map((entry) => (
          <tr key={entry.module} className="border-t border-slate-100">
            <td className="py-1.5 pr-3 text-slate-700">{entry.label}</td>
            {PRIVILEGE_ACTIONS.map((action) => (
              <td key={action} className="text-center">
                {entry.actions.includes(action) && (
                  <input
                    type="checkbox"
                    aria-label={`${entry.label}: ${ACTION_LABELS[action]}`}
                    checked={has(entry.module, action)}
                    disabled={!usable(action)}
                    onChange={(e) => apply([[entry, action]], e.target.checked)}
                    className="rounded accent-blue-600 cursor-pointer"
                  />
                )}
              </td>
            ))}
            <td className="text-center">
              <input
                type="checkbox"
                aria-label={`${entry.label}: all`}
                checked={allTicked(rowCells(entry))}
                onChange={(e) => apply(rowCells(entry), e.target.checked)}
                className="rounded accent-blue-600 cursor-pointer"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

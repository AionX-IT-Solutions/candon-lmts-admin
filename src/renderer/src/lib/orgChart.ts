import type { Committee, Official } from '../types'
import { getFullName } from './utils'
import { positionRank } from '../pages/officials/positions'

export interface OfficialTreeNode {
  official: Official
  children: OfficialTreeNode[]
}

/** Full name with the title in front, e.g. "Atty. Kristelle Gocho Singson". */
export function officialName(o: Official): string {
  return [o.title, getFullName(o.firstName, o.middleName, o.lastName, o.suffix)]
    .filter(Boolean)
    .join(' ')
}

/**
 * Each official's committees for the chart boxes (official id → lines): the ones they chair,
 * then vice chair / member roles. "Committee on" is dropped to keep the boxes short.
 */
export function committeesByOfficial(
  officials: Official[],
  committees: Committee[]
): Map<string, string[]> {
  const short = (title: string) => title.replace(/^Committee on /i, '')
  const result = new Map<string, string[]>()
  for (const o of officials) {
    // Committees keep names as text, saved with or without the title
    const names = new Set([
      officialName(o),
      getFullName(o.firstName, o.middleName, o.lastName, o.suffix)
    ])
    const lines = [
      ...committees.filter((c) => names.has(c.chairman)).map((c) => short(c.title)),
      ...committees
        .filter((c) => names.has(c.viceChairman))
        .map((c) => `${short(c.title)} (Vice Chair)`),
      ...committees
        .filter((c) => c.members?.some((m) => names.has(m)))
        .map((c) => `${short(c.title)} (Member)`)
    ]
    if (lines.length) result.set(o.id, lines)
  }
  return result
}

/**
 * Higher position first (Vice Mayor → Councilors → Ex-Officio), then in the order they were
 * added: members are entered by their number (1st, 2nd, …), so whoever was added first comes first.
 */
function compareOfficials(a: Official, b: Official): number {
  const byRank = positionRank(a.position) - positionRank(b.position)
  if (byRank !== 0) return byRank
  const added = (o: Official) => o.createdAt ?? ''
  return added(a) < added(b) ? -1 : added(a) > added(b) ? 1 : 0
}

/**
 * Builds a forest from the flat, `reportsToId`-referencing officials list (same algorithm as
 * GSPIS Admin's council board chart). An official is a root when they report to no one, or to
 * someone outside this list; `reached` doubles as a cycle guard so bad data can't recurse
 * forever, and anyone a cycle keeps from being reached still shows up as their own root.
 */
export function buildOfficialsTree(officials: Official[]): OfficialTreeNode[] {
  const byId = new Map(officials.map((o) => [o.id, o]))
  const childrenOf = new Map<string, Official[]>()
  const roots: Official[] = []

  for (const official of officials) {
    const parentId = official.reportsToId
    if (parentId && parentId !== official.id && byId.has(parentId)) {
      const siblings = childrenOf.get(parentId)
      if (siblings) siblings.push(official)
      else childrenOf.set(parentId, [official])
    } else {
      roots.push(official)
    }
  }

  const reached = new Set<string>()

  function toNode(official: Official): OfficialTreeNode {
    reached.add(official.id)
    const children = (childrenOf.get(official.id) ?? [])
      .filter((child) => !reached.has(child.id))
      .sort(compareOfficials)
    return { official, children: children.map(toNode) }
  }

  const tree = [...roots].sort(compareOfficials).map(toNode)
  const orphans = officials.filter((o) => !reached.has(o.id)).sort(compareOfficials)
  const orphanNodes: OfficialTreeNode[] = []
  for (const orphan of orphans) {
    if (reached.has(orphan.id)) continue
    orphanNodes.push(toNode(orphan))
  }
  return [...tree, ...orphanNodes]
}

function findNode(tree: OfficialTreeNode[], officialId: string): OfficialTreeNode | undefined {
  for (const node of tree) {
    if (node.official.id === officialId) return node
    const found = findNode(node.children, officialId)
    if (found) return found
  }
  return undefined
}

/**
 * Ids that `officialId` must not report to — itself and everyone under it (that would make a
 * reporting loop).
 */
export function collectDescendantIds(tree: OfficialTreeNode[], officialId: string): Set<string> {
  const ids = new Set<string>([officialId])
  const node = findNode(tree, officialId)
  function walk(n: OfficialTreeNode) {
    for (const child of n.children) {
      ids.add(child.official.id)
      walk(child)
    }
  }
  if (node) walk(node)
  return ids
}

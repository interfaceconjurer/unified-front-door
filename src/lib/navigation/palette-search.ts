type SearchItem = { label: string; searchNames?: readonly string[]; indent?: boolean };

const normalize = (value: string) => value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();

export function matchesPaletteQuery(query: string, ...parts: string[]): boolean {
  const text = normalize(parts.join(" "));
  return normalize(query).split(" ").every(term => text.includes(term));
}

/** Exact names, prefixes, partial names, then matches in descriptive metadata. */
export function paletteSearchRank(item: SearchItem, query: string): number {
  const q = normalize(query);
  const names = [item.label, ...(item.searchNames ?? [])].map(normalize);
  if (!q || names.includes(q)) return 0;
  if (names.some(name => name.startsWith(q))) return 1;
  if (names.some(name => q.split(" ").every(term => name.includes(term)))) return 2;
  return 3;
}

/** Rank whole project trees so a matched worktree never loses its parent. */
export function rankPaletteGroups<T extends SearchItem>(items: readonly T[], query: string): T[] {
  const groups: T[][] = [];
  for (const item of items) {
    const previous = groups.at(-1);
    if (item.indent && previous) previous.push(item);
    else groups.push([item]);
  }
  const rank = (group: T[]) => Math.min(...group.map(item => paletteSearchRank(item, query)));
  return groups.sort((a, b) => rank(a) - rank(b)).flat();
}

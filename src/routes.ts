export const navigation = ['Dashboard', 'Agents', 'Office', 'Task Board', 'Calendar', 'Activity', 'Memory', 'Folders', 'Logs'] as const
export type Page = typeof navigation[number]

export function pageSlug(page: Page): string {
  return page.toLowerCase().replace(/\s+/g, '-')
}

export function pageFromHash(hash: string): Page {
  const slug = hash.replace(/^#\/?/, '').split('/')[0].toLowerCase()
  if (slug === 'knowledge') return 'Memory'
  return navigation.find((page) => pageSlug(page) === slug) ?? 'Dashboard'
}

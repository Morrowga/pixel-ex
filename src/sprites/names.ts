/** Turns "Tractor!" or "ice cream" into a safe sprite name: lowercase letters, digits and underscores. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
}

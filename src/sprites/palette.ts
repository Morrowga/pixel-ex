/** One shared palette so every sprite looks like it belongs to the same world. '.' is transparent. */
export const PALETTE: Record<string, string> = {
  K: '#1f2233', // outline
  W: '#ffffff',
  G: '#a3a9b8', // grey
  R: '#e53935',
  O: '#fb8c00',
  Y: '#fdd835',
  L: '#43a047', // green
  D: '#1b5e20', // dark green
  B: '#1e88e5',
  C: '#7fd8f0', // light blue
  P: '#8e24aa',
  N: '#6d4c41', // brown
  T: '#e0b070', // tan
  M: '#f48fb1', // pink
  S: '#ffcc99', // skin
}

export const PALETTE_KEYS = Object.keys(PALETTE).join('')

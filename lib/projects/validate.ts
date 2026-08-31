export type Validation = { ok: true; value: string } | { ok: false; error: string }

export function validateProjectName(raw: string): Validation {
  const value = raw.trim()
  if (value.length === 0) return { ok: false, error: 'Le nom est requis' }
  if (value.length > 100) return { ok: false, error: '100 caractères maximum' }
  return { ok: true, value }
}

import { describe, expect, it } from 'vitest'
import { isE2EEnabled } from '@/lib/e2e'

describe('isE2EEnabled', () => {
  it("est désactivé quand E2E_ENABLED est absent", () => {
    expect(isE2EEnabled({})).toBe(false)
  })

  it("est désactivé pour toute valeur autre que '1' (y compris 'true')", () => {
    expect(isE2EEnabled({ E2E_ENABLED: 'true' })).toBe(false)
    expect(isE2EEnabled({ E2E_ENABLED: '0' })).toBe(false)
    expect(isE2EEnabled({ E2E_ENABLED: '' })).toBe(false)
  })

  it("est activé uniquement quand E2E_ENABLED vaut exactement '1'", () => {
    expect(isE2EEnabled({ E2E_ENABLED: '1' })).toBe(true)
  })
})

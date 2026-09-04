import { newInviteToken } from '@/lib/invitations/token'

describe('newInviteToken', () => {
  it('produit 43 caractères base64url, uniques', () => {
    const a = newInviteToken(), b = newInviteToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })
})

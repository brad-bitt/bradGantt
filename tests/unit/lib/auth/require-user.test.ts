const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}))

import { requireUser } from '@/lib/auth/require-user'

describe('requireUser', () => {
  beforeEach(() => mockGetUser.mockReset())

  it('retourne l\'utilisateur non-nul quand une session existe', async () => {
    const user = { id: 'u1', email: 'alice@test.local' }
    mockGetUser.mockResolvedValue({ data: { user } })
    await expect(requireUser()).resolves.toBe(user)
  })

  it('redirige vers /login quand il n\'y a pas de session (pas de user! non protégé)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    // redirect() de next/navigation lève une erreur dédiée (NEXT_REDIRECT) plutôt que de
    // retourner : requireUser() ne doit jamais renvoyer `null`/`undefined` en silence.
    await expect(requireUser()).rejects.toMatchObject({ digest: expect.stringContaining('/login') })
  })
})

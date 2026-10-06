// Écritures sur une seule ligne : `count !== 1` et non `count === 0`. Un `count` null (en-tête
// content-range absente) passait sinon pour un succès alors que la RLS avait refusé.
const mockEq2 = vi.fn()
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockEq1 }))
const mockDelete = vi.fn(() => ({ eq: mockEq1 }))
const mockFrom = vi.fn(() => ({ update: mockUpdate, delete: mockDelete }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ from: mockFrom })) }))
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }))

import { changeMemberRole, removeMember, revokeInvitation } from '@/app/(app)/(projet)/projects/[id]/members-actions'

describe('actions des membres', () => {
  beforeEach(() => { mockEq2.mockReset(); mockRevalidatePath.mockClear() })

  it.each([
    ['changeMemberRole', () => changeMemberRole('p1', 'u2', 'viewer')],
    ['removeMember', () => removeMember('p1', 'u2')],
    ['revokeInvitation', () => revokeInvitation('p1', 'i1')],
  ])('%s : count null est un échec', async (_name, call) => {
    mockEq2.mockResolvedValue({ error: null, count: null })
    expect((await call()).error).toBe('Modification non enregistrée')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('un succès revalide le layout du projet, où vit la pile d\'avatars', async () => {
    mockEq2.mockResolvedValue({ error: null, count: 1 })
    await removeMember('p1', 'u2')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/p1', 'layout')
  })
})

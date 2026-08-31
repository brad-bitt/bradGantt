// `count` vaut `null` quand l'en-tête `content-range` manque de la réponse PostgREST (mode
// ouvert) : ce cas n'est pas reproductible via l'environnement Supabase local utilisé par
// les tests e2e (qui renvoie toujours un count explicite, y compris 0), d'où ce test unitaire
// dédié à ce scénario précis — celui que `count === 0` laissait passer comme un faux succès.
const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate, delete: mockDelete }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { renameProject, deleteProject } from '@/app/(app)/projects/actions'

describe('renameProject / deleteProject : robustesse à un count non strictement égal à 1', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockFrom.mockClear()
  })

  it('renameProject : count null (en-tête content-range absente) est traité comme un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: null })
    const res = await renameProject('p1', 'Nouveau nom')
    expect(res.error).toBe('Modification non enregistrée')
  })

  it('deleteProject : count null (en-tête content-range absente) est traité comme un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: null })
    const res = await deleteProject('p1')
    expect(res.error).toBe('Suppression impossible')
  })

  it('renameProject : count à 0 (RLS a refusé, réponse normale) reste un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: 0 })
    const res = await renameProject('p1', 'Nouveau nom')
    expect(res.error).toBe('Modification non enregistrée')
  })

  it('renameProject : count à 1 (succès réel) ne retourne pas d\'erreur', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    const res = await renameProject('p1', 'Nouveau nom')
    expect(res.error).toBeUndefined()
  })

  it('deleteProject : count à 1 (succès réel) ne retourne pas d\'erreur', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    const res = await deleteProject('p1')
    expect(res.error).toBeUndefined()
  })
})

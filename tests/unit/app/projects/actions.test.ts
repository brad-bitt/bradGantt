// `count` vaut `null` quand l'en-tête `content-range` manque de la réponse PostgREST (mode
// ouvert) : ce cas n'est pas reproductible via l'environnement Supabase local utilisé par
// les tests e2e (qui renvoie toujours un count explicite, y compris 0), d'où ce test unitaire
// dédié à ce scénario précis — celui que `count === 0` laissait passer comme un faux succès.
const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate, delete: mockDelete }))
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mockFrom, rpc: mockRpc })),
}))
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }))

import { createProject, renameProject, deleteProject, setTicketsEnabled } from '@/app/(app)/(accueil)/projects/actions'

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

// La liste /projects doit être réinvalidée après une création. Ce verrou est UNITAIRE, et c'est
// un pis-aller assumé : depuis que la création redirige vers la page du projet (tâche 9), plus
// aucun parcours navigateur ne rend cet appel observable — le routeur de Next 15 refait de toute
// façon une requête serveur en revenant sur une route dynamique (vérifié : lien « ← Projets » et
// bouton Précédent, tous deux verts sans l'appel). Le comportement, lui, reste couvert de bout en
// bout par le renommage et la suppression dans tests/e2e/projects.spec.ts, qui restent sur
// /projects et tombent si leur `revalidatePath` disparaît.
describe('createProject : réinvalidation de la liste', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockRevalidatePath.mockReset()
  })

  it('réinvalide /projects après une création réussie', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'p1' }, error: null })
    const res = await createProject('Mon projet')
    expect(res.id).toBe('p1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
  })

  it('ne réinvalide rien quand la création échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await createProject('Mon projet')
    expect(res.error).toBe('Création impossible, réessaie.')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('setTicketsEnabled', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockUpdate.mockClear()
    mockFrom.mockClear()
    mockRevalidatePath.mockClear()
  })

  it('écrit la colonne et réinvalide la liste ET l\'en-tête de chaque page de projet', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    const res = await setTicketsEnabled('p1', true)
    expect(res.error).toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith({ tickets_enabled: true }, { count: 'exact' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/[id]', 'layout')
  })

  it('désactive aussi bien qu\'il active', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    await setTicketsEnabled('p1', false)
    expect(mockUpdate).toHaveBeenCalledWith({ tickets_enabled: false }, { count: 'exact' })
  })

  it('count null (en-tête content-range absente) est traité comme un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: null })
    expect((await setTicketsEnabled('p1', true)).error).toBe('Modification non enregistrée')
  })

  it('count à 0 (la RLS a refusé : l\'appelant n\'est pas propriétaire) est un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: 0 })
    expect((await setTicketsEnabled('p1', true)).error).toBe('Modification non enregistrée')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('renameProject : réinvalidation', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockRevalidatePath.mockClear()
  })

  // Le nom s'affiche dans l'en-tête de TOUTES les pages du projet : sans revalider leur layout,
  // l'en-tête garderait l'ancien nom jusqu'au prochain rechargement.
  it('réinvalide la liste et le layout de projet', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    await renameProject('p1', 'Nouveau nom')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/[id]', 'layout')
  })
})

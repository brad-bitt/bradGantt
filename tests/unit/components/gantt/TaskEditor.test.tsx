import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskEditor } from '@/components/gantt/TaskEditor'
import { useGanttStore } from '@/lib/gantt/store'
import type { Role, Task } from '@/lib/gantt/types'
import { makeTask } from '../../lib/gantt/fixtures'

const createTask = vi.fn()
const updateTask = vi.fn()
const deleteTask = vi.fn()
vi.mock('@/lib/gantt/client-commands', () => ({
  getGanttCommands: () => ({
    createTask: (...args: unknown[]) => createTask(...args),
    updateTask: (...args: unknown[]) => updateTask(...args),
    deleteTask: (...args: unknown[]) => deleteTask(...args),
  }),
}))

const TODAY = '2026-09-15'

function hydrate(tasks: Task[] = [], myRole: Role = 'owner') {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId: 'p1',
      projectName: 'Projet',
      myRole,
      members: [{ userId: 'u1', role: 'editor', displayName: 'Alice Test', email: 'a@test.local', avatarUrl: null, color: '#FFD500' }],
      tasks,
      dependencies: [],
      today: TODAY,
    })
  })
}

function open(editor: Parameters<ReturnType<typeof useGanttStore.getState>['openEditor']>[0]) {
  act(() => { useGanttStore.getState().openEditor(editor) })
}

beforeEach(() => {
  createTask.mockReset().mockResolvedValue(makeTask())
  updateTask.mockReset().mockResolvedValue(true)
  deleteTask.mockReset().mockResolvedValue(true)
})

describe('TaskEditor : ouverture', () => {
  it('ne rend rien tant qu\'aucun éditeur n\'est ouvert', () => {
    hydrate()
    render(<TaskEditor />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ne rend rien pour un lecteur, même si `openEditor` a été appelé', () => {
    // Les trois points d'ouverture filtrent déjà sur `canEdit` ; ceci est le dernier verrou.
    hydrate([], 'viewer')
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ne rend rien si la tâche à éditer a disparu du store', () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 'fantôme' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('titre la modale selon le type et le mode', () => {
    const task = makeTask({ id: 't1', type: 'group', title: 'Phase 1' })
    hydrate([task])
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'milestone' })
    expect(screen.getByRole('dialog', { name: 'Nouveau jalon' })).toBeInTheDocument()
    open({ mode: 'edit', taskId: 't1' })
    expect(screen.getByRole('dialog', { name: 'Modifier le groupe' })).toBeInTheDocument()
  })

  it('repart d\'un formulaire vierge quand on passe de « + Tâche » à « + Jalon »', async () => {
    // Les deux ouvertures sont en mode `create` : sans le type dans la clé de remontage, l'état
    // du premier formulaire (titre déjà saisi) survivrait au changement de type.
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), 'Brouillon')
    open({ mode: 'create', parentId: null, type: 'milestone' })
    expect(screen.getByLabelText('Titre')).toHaveValue('')
  })
})

describe('TaskEditor : création', () => {
  it('crée une tâche avec les valeurs par défaut du projet', async () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), '  Maquettes  ')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(createTask).toHaveBeenCalledTimes(1)
    expect(createTask).toHaveBeenCalledWith({
      title: 'Maquettes',
      type: 'task',
      startDate: TODAY,
      endDate: '2026-09-17',
      progress: 0,
      color: '#FFD500',
      assigneeId: null,
      parentId: null,
    })
    expect(useGanttStore.getState().editor).toBeNull()
  })

  it('un jalon part sur un seul jour, sans avancement ni champ « Fin »', async () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'milestone' })
    expect(screen.queryByLabelText('Fin')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Avancement')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Titre'), 'Kick-off')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ type: 'milestone', startDate: TODAY, endDate: TODAY, progress: 0 }))
  })

  it('un groupe part sans parent ni assigné', async () => {
    hydrate([makeTask({ id: 'g1', type: 'group', title: 'Phase 1' })])
    render(<TaskEditor />)
    open({ mode: 'create', parentId: 'g1', type: 'group' })
    expect(screen.queryByLabelText('Groupe')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Assigné à')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Titre'), 'Phase 2')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ type: 'group', parentId: null, assigneeId: null, progress: 0 }))
  })

  it('reprend le groupe et l\'assigné choisis', async () => {
    hydrate([makeTask({ id: 'g1', type: 'group', title: 'Phase 1' })])
    render(<TaskEditor />)
    open({ mode: 'create', parentId: 'g1', type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), 'Ateliers')
    await userEvent.selectOptions(screen.getByLabelText('Assigné à'), 'u1')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'g1', assigneeId: 'u1' }))
  })

  it('passer le type à « Jalon » masque la fin et normalise les dates', async () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), 'Livraison')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'milestone')
    expect(screen.queryByLabelText('Fin')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ type: 'milestone', endDate: TODAY }))
  })

  it('choisit la couleur suivante de la palette, et respecte celle qu\'on sélectionne', async () => {
    hydrate([makeTask({ id: 't1', color: '#FFD500' })])
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), 'X')
    expect(screen.getByRole('button', { name: 'rose' })).toHaveAttribute('aria-pressed', 'true')
    // La coche est le SEUL repère visuel de la sélection : `brutal-focus` pose `outline-none`,
    // qui efface le liseré pointillé utilisé ailleurs dans l'application.
    expect(screen.getByRole('button', { name: 'rose' })).toHaveTextContent('✓')
    expect(screen.getByRole('button', { name: 'violet' })).not.toHaveTextContent('✓')
    await userEvent.click(screen.getByRole('button', { name: 'violet' }))
    expect(screen.getByRole('button', { name: 'violet' })).toHaveTextContent('✓')
    expect(screen.getByRole('button', { name: 'rose' })).not.toHaveTextContent('✓')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ color: '#A855F7' }))
  })

  it('un échec de persistance laisse la modale ouverte', async () => {
    createTask.mockResolvedValue(null)
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), 'Maquettes')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(useGanttStore.getState().editor).not.toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('TaskEditor : validation inline', () => {
  it('refuse un titre vide sans rien envoyer', async () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Le titre est requis')
    expect(createTask).not.toHaveBeenCalled()
    expect(useGanttStore.getState().editor).not.toBeNull()
  })

  it('refuse une fin antérieure au début', async () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.type(screen.getByLabelText('Titre'), 'X')
    await userEvent.clear(screen.getByLabelText('Fin'))
    await userEvent.type(screen.getByLabelText('Fin'), '2026-09-01')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('La fin doit être après le début')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('efface le message inline dès que la saisie devient valide', async () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeInTheDocument()

    createTask.mockResolvedValue(null) // échec de persistance : la modale reste ouverte
    await userEvent.type(screen.getByLabelText('Titre'), 'Maquettes')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument()
    expect(createTask).toHaveBeenCalledTimes(1)
  })
})

describe('TaskEditor : modification', () => {
  const existing = () => makeTask({
    id: 't1', title: 'Cadrage', startDate: '2026-09-10', endDate: '2026-09-12',
    progress: 20, color: '#3B82F6', assigneeId: null, parentId: null,
  })

  it('n\'envoie QUE les champs réellement modifiés', async () => {
    hydrate([existing()])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 't1' })
    await userEvent.clear(screen.getByLabelText('Titre'))
    await userEvent.type(screen.getByLabelText('Titre'), 'Cadrage v2')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTask).toHaveBeenCalledWith('t1', { title: 'Cadrage v2' })
    expect(useGanttStore.getState().editor).toBeNull()
  })

  it('n\'écrit rien quand rien n\'a changé, et referme quand même', async () => {
    hydrate([existing()])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 't1' })
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTask).not.toHaveBeenCalled()
    expect(useGanttStore.getState().editor).toBeNull()
  })

  it('préremplit tous les champs depuis la tâche', () => {
    hydrate([existing()])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 't1' })
    expect(screen.getByLabelText('Titre')).toHaveValue('Cadrage')
    expect(screen.getByLabelText('Début')).toHaveValue('2026-09-10')
    expect(screen.getByLabelText('Fin')).toHaveValue('2026-09-12')
    expect(screen.getByLabelText('Avancement')).toHaveValue(20)
    expect(screen.getByRole('button', { name: 'bleu' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('convertir une tâche en jalon force la fin sur le début', async () => {
    hydrate([existing()])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 't1' })
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'milestone')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTask).toHaveBeenCalledWith('t1', { type: 'milestone', endDate: '2026-09-10', progress: 0 })
  })

  it('un groupe ne propose pas de changer de type', () => {
    hydrate([makeTask({ id: 'g1', type: 'group', title: 'Phase 1' })])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 'g1' })
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument()
  })

  it('un groupe ne se propose pas lui-même comme parent', () => {
    hydrate([makeTask({ id: 'g1', type: 'group', title: 'Phase 1' }), makeTask({ id: 'g2', type: 'group', title: 'Phase 2' })])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 'g1' })
    expect(screen.queryByLabelText('Groupe')).not.toBeInTheDocument()
  })
})

describe('TaskEditor : suppression', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm')
  })
  afterEach(() => { confirmSpy.mockRestore() })

  it('supprime après confirmation et referme la modale', async () => {
    confirmSpy.mockReturnValue(true)
    hydrate([makeTask({ id: 't1', title: 'Cadrage' })])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 't1' })
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(confirmSpy).toHaveBeenCalledWith('Supprimer « Cadrage » ?')
    expect(deleteTask).toHaveBeenCalledWith('t1')
    expect(useGanttStore.getState().editor).toBeNull()
  })

  it('ne supprime rien si la confirmation est refusée', async () => {
    confirmSpy.mockReturnValue(false)
    hydrate([makeTask({ id: 't1', title: 'Cadrage' })])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 't1' })
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(deleteTask).not.toHaveBeenCalled()
    expect(useGanttStore.getState().editor).not.toBeNull()
  })

  it('prévient qu\'un groupe emporte ses tâches', async () => {
    confirmSpy.mockReturnValue(false)
    hydrate([makeTask({ id: 'g1', type: 'group', title: 'Phase 1' })])
    render(<TaskEditor />)
    open({ mode: 'edit', taskId: 'g1' })
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(confirmSpy).toHaveBeenCalledWith('Supprimer le groupe « Phase 1 » et toutes ses tâches ?')
  })

  it('ne propose pas la suppression à la création', () => {
    hydrate()
    render(<TaskEditor />)
    open({ mode: 'create', parentId: null, type: 'task' })
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })
})

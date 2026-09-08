import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextMenu } from '@/components/gantt/ContextMenu'
import { useGanttStore } from '@/lib/gantt/store'
import type { MenuTarget, Role, Task } from '@/lib/gantt/types'
import { makeTask, makeDep } from '../../lib/gantt/fixtures'

const deleteTask = vi.fn()
const unlinkTasks = vi.fn()
const duplicateTask = vi.fn()
const toggleGroup = vi.fn()
vi.mock('@/lib/gantt/client-commands', () => ({
  getGanttCommands: () => ({
    deleteTask: (...args: unknown[]) => deleteTask(...args),
    unlinkTasks: (...args: unknown[]) => unlinkTasks(...args),
    duplicateTask: (...args: unknown[]) => duplicateTask(...args),
    toggleGroup: (...args: unknown[]) => toggleGroup(...args),
  }),
}))

const group = makeTask({ id: 'g', type: 'group', title: 'Cadrage' })
const task = makeTask({ id: 'a', parentId: 'g', title: 'Ateliers' })
const milestone = makeTask({ id: 'm', type: 'milestone', title: 'Kick-off', startDate: '2026-09-14', endDate: '2026-09-14' })

function hydrate(tasks: Task[], myRole: Role = 'editor') {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks, dependencies: [makeDep('a', 'm')], today: '2026-09-08',
    })
  })
}

function open(target: MenuTarget) {
  act(() => { useGanttStore.getState().openMenu({ x: 100, y: 100, target }) })
}

function labels() {
  return screen.getAllByRole('menuitem').map((b) => b.textContent)
}

beforeEach(() => {
  deleteTask.mockReset().mockResolvedValue(true)
  unlinkTasks.mockReset().mockResolvedValue(true)
  duplicateTask.mockReset().mockResolvedValue(makeTask())
  toggleGroup.mockReset().mockResolvedValue(true)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ContextMenu', () => {
  it('ne rend rien tant qu’aucun menu n’est ouvert, ni pour un lecteur', () => {
    hydrate([group, task, milestone], 'viewer')
    render(<ContextMenu />)
    expect(screen.queryByRole('menu')).toBeNull()
    open({ kind: 'task', id: 'a' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('propose modifier, ajouter après, dupliquer et supprimer sur une tâche', () => {
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'task', id: 'a' })
    expect(labels()).toEqual(['Modifier…', 'Ajouter après ↳', 'Dupliquer', 'Supprimer'])
    // Le premier élément reçoit le focus : le menu se parcourt au clavier dès l'ouverture.
    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0])
  })

  it('propose les actions de groupe, et le libellé de repli suit l’état', () => {
    hydrate([{ ...group, collapsed: true }, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'task', id: 'g' })
    expect(labels()).toEqual(['Modifier…', 'Ajouter une tâche dans le groupe', 'Groupe suivant ↳', 'Déplier', 'Supprimer le groupe et ses tâches'])
  })

  it('sur un lien, ne propose que sa suppression', async () => {
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'dependency', id: 'a->m' })
    expect(labels()).toEqual(['Supprimer le lien'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer le lien' }))
    expect(unlinkTasks).toHaveBeenCalledWith('a->m')
    expect(useGanttStore.getState().menu).toBeNull()
  })

  it('sur le fond de la frise, propose de créer à la date visée', async () => {
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'timeline', date: '2026-09-21' })
    expect(labels()).toEqual(['Nouvelle tâche le 21 sept.', 'Nouveau jalon le 21 sept.', 'Nouveau groupe'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nouveau jalon le 21 sept.' }))
    expect(useGanttStore.getState().editor).toEqual({ mode: 'create', parentId: null, type: 'milestone', startDate: '2026-09-21' })
  })

  it('« Supprimer » demande confirmation puis supprime et désélectionne', async () => {
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    act(() => { useGanttStore.getState().select({ kind: 'task', id: 'a' }) })
    open({ kind: 'task', id: 'a' })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(window.confirm).toHaveBeenCalledWith('Supprimer « Ateliers » ?')
    expect(deleteTask).toHaveBeenCalledWith('a')
    expect(useGanttStore.getState().selection).toBeNull()
  })

  it('« Supprimer » refusé ne fait rien', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'task', id: 'a' })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(deleteTask).not.toHaveBeenCalled()
  })

  it('Échap ferme le menu', async () => {
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'task', id: 'a' })
    await userEvent.keyboard('{Escape}')
    expect(useGanttStore.getState().menu).toBeNull()
  })

  it('les flèches déplacent le focus en boucle', async () => {
    hydrate([group, task, milestone])
    render(<ContextMenu />)
    open({ kind: 'task', id: 'a' })
    const items = screen.getAllByRole('menuitem')
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(items[items.length - 1])
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[0])
  })
})

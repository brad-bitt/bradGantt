import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Menu, type MenuEntry } from '@/components/ui/Menu'

function setup() {
  const onRename = vi.fn()
  const onDelete = vi.fn()
  const entries: MenuEntry[] = [
    { id: 'rename', label: 'Renommer', onSelect: onRename },
    { kind: 'heading', id: 'move', label: 'Déplacer vers…' },
    { id: 'doing', label: 'En cours', onSelect: vi.fn() },
    { id: 'delete', label: 'Supprimer', danger: true, onSelect: onDelete },
  ]
  render(
    <>
      <Menu label="Actions du projet" entries={entries} />
      <button type="button">Ailleurs</button>
    </>,
  )
  return { onRename, onDelete, trigger: screen.getByRole('button', { name: 'Actions du projet' }) }
}

describe('Menu', () => {
  it('annonce un menu replié, puis l\'ouvre avec le focus sur le premier item', async () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Actions du projet' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveFocus()
  })

  it('les flèches parcourent les items en boucle et sautent l\'intitulé', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'En cours' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveFocus()
  })

  it('Échap referme et rend le focus au déclencheur', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('Entrée déclenche l\'item, referme et rend le focus', async () => {
    const { trigger, onRename } = setup()
    await userEvent.click(trigger)
    await userEvent.keyboard('{Enter}')
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('un item destructif est rouge', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveClass('text-danger')
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).not.toHaveClass('text-danger')
  })

  it('un clic ailleurs referme sans rien déclencher', async () => {
    const { trigger, onRename, onDelete } = setup()
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: 'Ailleurs' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  // Review Focus 1 : le menu vit sur des surfaces actives (carte qu'on glisse, carte-lien).
  it('ni le pointeur, ni le clic, ni le double-clic ne remontent au parent', async () => {
    const onPointerDown = vi.fn()
    const onClick = vi.fn()
    const onDoubleClick = vi.fn()
    const onSelect = vi.fn()
    render(
      <div onPointerDown={onPointerDown} onClick={onClick} onDoubleClick={onDoubleClick}>
        <Menu label="Actions" entries={[{ id: 'a', label: 'Faire', onSelect }]} />
      </div>,
    )
    await userEvent.dblClick(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Faire' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
    expect(onDoubleClick).not.toHaveBeenCalled()
  })
})

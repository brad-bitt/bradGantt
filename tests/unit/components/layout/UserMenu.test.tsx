import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/layout/UserMenu'
import { ProfileProvider } from '@/components/layout/ProfileProvider'

const mockSignOut = vi.fn()
vi.mock('@/app/(app)/projects/actions', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

function renderMenu() {
  return render(
    <ProfileProvider profile={{ displayName: 'Alice Test', email: 'alice@test.local', color: '#FFD500', avatarUrl: null }}>
      <UserMenu />
    </ProfileProvider>,
  )
}

describe('UserMenu', () => {
  beforeEach(() => {
    mockSignOut.mockReset()
    document.documentElement.dataset.theme = 'light'
    localStorage.clear()
  })

  it('l\'avatar ouvre un menu qui dit qui est connecté', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    const menu = screen.getByRole('menu', { name: 'Menu du compte' })
    expect(menu).toHaveTextContent('Alice Test')
    expect(menu).toHaveTextContent('alice@test.local')
  })

  it('bascule le thème, l\'enregistre, et le libellé suit', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Passer au thème sombre' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('bradgantt.theme')).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    expect(screen.getByRole('menuitem', { name: 'Passer au thème clair' })).toBeInTheDocument()
  })

  it('« Déconnexion » appelle l\'action serveur', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Déconnexion' }))
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })
})

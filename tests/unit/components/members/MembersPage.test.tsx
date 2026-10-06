import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MembersPage } from '@/components/members/MembersPage'
import type { Member } from '@/lib/gantt/types'

const mockRevoke = vi.fn()
vi.mock('@/app/(app)/(projet)/projects/[id]/members-actions', () => ({
  revokeInvitation: (...args: unknown[]) => mockRevoke(...args),
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
}))
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }) }))

const members: Member[] = [
  { userId: 'u2', role: 'viewer', displayName: 'Zoé', email: 'z@t.l', avatarUrl: null, color: '#5B9DFF' },
  { userId: 'u1', role: 'owner', displayName: 'Alice', email: 'a@t.l', avatarUrl: null, color: '#FFD500' },
  { userId: 'u3', role: 'editor', displayName: 'Bob', email: 'b@t.l', avatarUrl: null, color: '#FF8A3D' },
]
const invitations = [{ id: 'i1', email: 'x@t.l', role: 'viewer' as const, createdAt: '2026-10-01' }]

describe('MembersPage', () => {
  beforeEach(() => { mockRevoke.mockReset(); mockRefresh.mockReset() })

  it('est une région « Membres », propriétaire en tête puis ordre alphabétique', () => {
    render(<MembersPage projectId="p1" members={members} invitations={[]} isOwner={false} />)
    const items = within(screen.getByRole('region', { name: 'Membres' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Alice'),
      expect.stringContaining('Bob'),
      expect.stringContaining('Zoé'),
    ])
  })

  it('un non-propriétaire lit les rôles en français, sans aucune commande', () => {
    render(<MembersPage projectId="p1" members={members} invitations={invitations} isOwner={false} />)
    expect(screen.getByText('Propriétaire')).toBeInTheDocument()
    expect(screen.getByText('Éditeur')).toBeInTheDocument()
    expect(screen.getByText('Lecteur')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inviter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pending-list')).not.toBeInTheDocument()
  })

  it('pour le propriétaire, une ligne modifiable montre le sélecteur au lieu du badge', () => {
    render(<MembersPage projectId="p1" members={members} invitations={[]} isOwner />)
    const bob = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('Bob'))!
    expect(within(bob).getByLabelText('Rôle de Bob')).toHaveValue('editor')
    expect(within(bob).queryByText('Éditeur', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('le propriétaire voit les invitations en attente et peut en révoquer une', async () => {
    mockRevoke.mockResolvedValue({})
    render(<MembersPage projectId="p1" members={members} invitations={invitations} isOwner />)
    const pending = screen.getByTestId('pending-list')
    expect(within(pending).getByText('x@t.l')).toBeInTheDocument()
    expect(within(pending).getByText('Lecteur')).toBeInTheDocument()
    await userEvent.click(within(pending).getByRole('button', { name: 'Révoquer' }))
    expect(mockRevoke).toHaveBeenCalledWith('p1', 'i1')
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeInTheDocument()
  })
})

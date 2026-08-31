import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '@/components/ui/Dialog'

describe('Dialog', () => {
  it('ne rend rien si fermé', () => {
    render(<Dialog open={false} onClose={() => {}} title="Test">contenu</Dialog>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('rend le titre et le contenu si ouvert', () => {
    render(<Dialog open onClose={() => {}} title="Nouveau projet">contenu</Dialog>)
    expect(screen.getByRole('dialog', { name: 'Nouveau projet' })).toBeInTheDocument()
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })
  it('appelle onClose sur Échap et sur le bouton Fermer', async () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="T">x</Dialog>)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

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

  it('déplace le focus dans la modale à l\'ouverture', () => {
    const { rerender } = render(<Dialog open onClose={() => {}} title="Test"><button>Bouton</button></Dialog>)
    const btn = screen.getByText('Bouton')
    expect(btn).toHaveFocus()
  })

  it('restaure le focus au déclencheur à la fermeture', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const { rerender } = render(<Dialog open onClose={onClose} title="Test">contenu</Dialog>)
    rerender(<Dialog open={false} onClose={onClose} title="Test">contenu</Dialog>)
    expect(trigger).toHaveFocus()
    document.body.removeChild(trigger)
  })

  it('garde le focus sur un champ avec autoFocus', () => {
    render(<Dialog open onClose={() => {}} title="Test"><input autoFocus /></Dialog>)
    const input = screen.getByRole('textbox')
    expect(input).toHaveFocus()
  })
})

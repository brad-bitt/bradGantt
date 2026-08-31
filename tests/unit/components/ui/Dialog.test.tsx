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
    render(<Dialog open onClose={() => {}} title="Test"><button>Bouton</button></Dialog>)
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

  it('garde le focus sur un champ avec autoFocus (pas le premier focusable)', () => {
    render(
      <Dialog open onClose={() => {}} title="Test">
        <button>Premier</button>
        <input autoFocus placeholder="Deuxième" />
        <button>Troisième</button>
      </Dialog>
    )
    const input = screen.getByPlaceholderText('Deuxième')
    expect(input).toHaveFocus()
  })

  it('boucle Tab depuis le dernier élément au premier (le piège couvre toute la modale, Fermer inclus)', async () => {
    render(
      <Dialog open onClose={() => {}} title="Test">
        <button>Premier</button>
        <button>Deuxième</button>
      </Dialog>
    )
    const fermer = screen.getByRole('button', { name: 'Fermer' })
    const premier = screen.getByText('Premier')
    const deuxieme = screen.getByText('Deuxième')
    // Ouverture sans autoFocus : le focus initial va au premier élément du CONTENU
    // (comportement UX volontaire, distinct de l'ordre du piège Tab lui-même).
    expect(premier).toHaveFocus()
    await userEvent.tab()
    expect(deuxieme).toHaveFocus()
    // Le dernier élément de la modale (Deuxième) boucle vers le PREMIER élément de la
    // modale entière, qui est Fermer (header), pas Premier (contenu).
    await userEvent.tab()
    expect(fermer).toHaveFocus()
    await userEvent.tab()
    expect(premier).toHaveFocus()
  })

  it('boucle Shift+Tab depuis le premier élément de la modale (Fermer) au dernier', async () => {
    render(
      <Dialog open onClose={() => {}} title="Test">
        <button>Premier</button>
        <button>Deuxième</button>
      </Dialog>
    )
    const fermer = screen.getByRole('button', { name: 'Fermer' })
    const premier = screen.getByText('Premier')
    const deuxieme = screen.getByText('Deuxième')
    fermer.focus()
    await userEvent.tab({ shift: true })
    expect(deuxieme).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(premier).toHaveFocus()
  })

  it('le piège Tab couvre toute la modale : le bouton Fermer du header et les actions du footer sont atteignables', async () => {
    render(
      <Dialog open onClose={() => {}} title="Test" footer={<button>Enregistrer</button>}>
        <button>Contenu</button>
      </Dialog>
    )
    const fermer = screen.getByRole('button', { name: 'Fermer' })
    const contenu = screen.getByText('Contenu')
    const enregistrer = screen.getByText('Enregistrer')

    // Ordre DOM : Fermer (header) -> Contenu -> Enregistrer (footer), puis boucle.
    expect(contenu).toHaveFocus()
    await userEvent.tab()
    expect(enregistrer).toHaveFocus()
    await userEvent.tab()
    expect(fermer).toHaveFocus()
    await userEvent.tab()
    expect(contenu).toHaveFocus()

    // Shift+Tab depuis le contenu doit atteindre Fermer, pas rester coincé dans le contenu.
    await userEvent.tab({ shift: true })
    expect(fermer).toHaveFocus()
  })
})

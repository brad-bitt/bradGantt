import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// Spec §3 : les capitales grasses ne servent plus qu'aux titres. Un libellé de champ en
// capitales criait plus fort que le titre de la fenêtre qui le contenait.
describe('libellés de champ en casse mixte', () => {
  it('Input, Select et Textarea', () => {
    render(
      <>
        <Input label="Titre" />
        <Select label="Statut" options={[{ value: 'a', label: 'A' }]} />
        <Textarea label="Description" />
      </>,
    )
    for (const name of ['Titre', 'Statut', 'Description']) {
      expect(screen.getByText(name)).not.toHaveClass('uppercase')
    }
  })
})

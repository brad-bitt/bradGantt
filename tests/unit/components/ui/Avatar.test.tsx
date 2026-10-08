import { render, screen } from '@testing-library/react'
import { Avatar, initials } from '@/components/ui/Avatar'

describe('initials', () => {
  it('prend les initiales des deux premiers mots', () => expect(initials('Alice Test')).toBe('AT'))
  it('prend deux lettres si un seul mot', () => expect(initials('bob')).toBe('BO'))
  it('gère une chaîne vide', () => expect(initials('')).toBe('?'))
})

describe('Avatar', () => {
  it('affiche les initiales, en encre', () => {
    render(<Avatar name="Alice Test" color="#FF6B9D" />)
    const el = screen.getByTitle('Alice Test')
    expect(el).toHaveTextContent('AT')
    // Spec §4 : les avatars des autres sont en encre ; seul celui de l'utilisateur est en or.
    expect(el).toHaveClass('bg-ink', 'text-paper')
    expect(el.style.backgroundColor).toBe('')
  })
  it("affiche l'image si src fourni", () => {
    render(<Avatar name="Alice" color="#FFD500" src="https://x/y.png" />)
    expect(screen.getByRole('img', { name: 'Alice' })).toHaveAttribute('src', 'https://x/y.png')
  })

  it('est rond, en Plex semi-gras, texte sombre fixe sur la couleur', () => {
    render(<Avatar name="Alice Test" color="#FF6B9D" />)
    const el = screen.getByTitle('Alice Test')
    expect(el).toHaveClass('rounded-full', 'font-ui', 'font-semibold')
    expect(el).not.toHaveClass('border-[3px]')
    expect(el).not.toHaveClass('font-display')
  })

  it('l’avatar de l’utilisateur est en or, sans fond d’encre concurrent', () => {
    render(<Avatar name="Moi Même" color="#FF6B9D" me />)
    const el = screen.getByTitle('Moi Même')
    expect(el).toHaveClass('bg-accent')
    expect(el).not.toHaveClass('bg-ink')
  })
})

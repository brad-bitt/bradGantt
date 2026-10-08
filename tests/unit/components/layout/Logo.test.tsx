import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { Mark, Wordmark } from '@/components/layout/Logo'

describe('le signe (spec §11)', () => {
  it('est un carré d’encre nu, sans cadre, avec trois barres en aplat', () => {
    const { container } = render(<Mark />)
    const rects = Array.from(container.querySelectorAll('rect'))
    expect(rects).toHaveLength(4)
    // Encre du thème : sur le papier sombre, un carré #2A2622 fixe disparaissait (revue M4).
    expect(rects[0]).toHaveAttribute('fill', 'var(--color-ink)')
    expect(rects.some((r) => r.getAttribute('stroke'))).toBe(false)
    expect(rects.slice(1).map((r) => r.getAttribute('fill'))).toEqual(['#5B9DFF', '#FF8A3D', '#FF6FA3'])
  })

  it('le favicon est le même dessin', () => {
    const svg = readFileSync('app/icon.svg', 'utf8')
    expect(svg).toContain('fill="#2A2622"')
    expect(svg).not.toContain('stroke=')
    expect(svg).not.toContain('#111111')
  })

  it('le nom est en Fraunces, casse mixte', () => {
    const { getByText } = render(<Wordmark />)
    expect(getByText('BradGantt')).toHaveClass('font-display', 'font-medium')
    expect(getByText('BradGantt')).not.toHaveClass('normal-case')
  })
})

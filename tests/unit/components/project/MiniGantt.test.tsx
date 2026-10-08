import { render } from '@testing-library/react'
import { MiniGantt, MiniGanttPlaceholder } from '@/components/project/MiniGantt'
import type { MiniTask } from '@/lib/gantt/mini'

const task: MiniTask = { type: 'task', startDate: '2026-10-01', endDate: '2026-10-05', color: '#5B9DFF' }

describe('MiniGantt (spec §6)', () => {
  it('les barres sont des `data-bar` qui posent leur couleur en variable', () => {
    const { container } = render(
      <MiniGantt tasks={[task]} range={{ start: '2026-10-01', end: '2026-10-10' }} today="2026-10-03" />,
    )
    const bar = container.querySelector('.data-bar') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.style.getPropertyValue('--bar-color')).toBe('#5B9DFF')
    expect(bar).not.toHaveClass('border-2')
  })
  it('le gabarit vide est un filet pointillé', () => {
    const { container } = render(<MiniGanttPlaceholder />)
    expect(container.firstChild).toHaveClass('border-dashed', 'border-line')
  })
})

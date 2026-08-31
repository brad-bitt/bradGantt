import { TASK_COLORS, nextColor } from '@/lib/gantt/palette'

describe('nextColor', () => {
  it('retourne la couleur la moins utilisée, dans l\'ordre de la palette', () => {
    expect(nextColor([])).toBe(TASK_COLORS[0])
    expect(nextColor([TASK_COLORS[0]])).toBe(TASK_COLORS[1])
    expect(nextColor([...TASK_COLORS, TASK_COLORS[0]])).toBe(TASK_COLORS[1])
  })
})

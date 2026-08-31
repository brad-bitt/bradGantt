export const TASK_COLORS = ['#FFD500', '#FF6B9D', '#3B82F6', '#22C55E', '#FF8A00', '#A855F7'] as const

export function nextColor(usedColors: string[]): string {
  const counts = TASK_COLORS.map((c) => usedColors.filter((u) => u === c).length)
  const min = Math.min(...counts)
  return TASK_COLORS[counts.indexOf(min)]
}

/**
 * Couleurs de tâches. Le jaune #FFD500 en est volontairement ABSENT : il signale la
 * sélection dans toute l'application, et une tâche jaune serait indiscernable d'une ligne
 * sélectionnée. Huit teintes, écartées en clarté autant qu'en teinte — l'ancien jeu les
 * gardait toutes à saturation maximale, ce qui rendait l'orange et le jaune confondables.
 */
export const TASK_COLORS = [
  '#FF8A3D', '#FF6FA3', '#5B9DFF', '#3ECF8E',
  '#A78BFA', '#34D3E0', '#B4E45C', '#E9B44C',
] as const

export function nextColor(usedColors: string[]): string {
  const counts = TASK_COLORS.map((c) => usedColors.filter((u) => u === c).length)
  const min = Math.min(...counts)
  return TASK_COLORS[counts.indexOf(min)]
}

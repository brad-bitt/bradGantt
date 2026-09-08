'use client'
import { useGanttStore } from './store'
import { getGanttCommands } from './client-commands'
import { findTemplate, instantiate } from './templates'

/**
 * Applique un modèle au projet courant : crée ses lignes une à une, dans l'ordre du modèle,
 * puis les liens.
 *
 * Une création par ligne plutôt qu'une écriture groupée : les commandes existantes portent déjà
 * l'optimisme, le retour arrière ciblé et le toast d'erreur, et un modèle fait moins de dix
 * lignes. Les identifiants sont attribués au fil de l'eau — un enfant a besoin de celui de son
 * groupe, un lien de celui de ses deux bouts —, d'où la carte `ids` et l'ordre imposé par les
 * tests des modèles (parent et prédécesseurs toujours déclarés avant).
 *
 * En cas d'échec, on s'arrête : les lignes déjà créées restent (elles sont en base), le toast
 * de la commande a dit ce qui s'est passé, et l'utilisateur voit exactement ce qui existe.
 */
export async function applyTemplate(templateId: string): Promise<boolean> {
  const template = findTemplate(templateId)
  if (!template) return false
  const today = useGanttStore.getState().today
  const cmd = getGanttCommands()
  const ids = new Map<string, string>()

  for (const item of instantiate(template, today)) {
    const created = await cmd.createTask({
      title: item.title,
      type: item.type,
      startDate: item.startDate,
      endDate: item.endDate,
      color: item.color,
      parentId: item.parent ? (ids.get(item.parent) ?? null) : null,
    })
    if (!created) return false
    ids.set(item.key, created.id)
    for (const key of item.after) {
      const from = ids.get(key)
      if (from && !(await cmd.linkTasks(from, created.id))) return false
    }
  }
  return true
}

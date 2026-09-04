'use client'
import { useEffect } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'

/**
 * Vrai si la frappe est destinée à une saisie. Sans ce garde-fou, effacer un caractère du titre
 * dans l'éditeur supprimerait la tâche sélectionnée derrière la modale.
 */
function inField(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/**
 * Raccourcis de la vue Gantt, posés sur la fenêtre : `Échap` ferme l'éditeur ou désélectionne,
 * `Suppr`/`Retour arrière` supprime la sélection — une dépendance sans confirmation (le geste se
 * refait d'un glissement), une tâche ou un groupe après confirmation (la suppression d'un groupe
 * emporte ses enfants).
 *
 * L'état est lu par `getState()` dans le gestionnaire et non par abonnement : le hook s'installe
 * une fois pour toutes, et rien ne dépend d'une valeur capturée à l'installation.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      if (inField(e.target)) return
      const s = useGanttStore.getState()
      if (e.key === 'Escape') {
        if (s.editor) s.closeEditor()
        else s.select(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection && s.myRole !== 'viewer' && !s.editor) {
        // `Retour arrière` hors champ de saisie, c'est la navigation arrière du navigateur.
        e.preventDefault()
        const cmd = getGanttCommands()
        if (s.selection.kind === 'dependency') {
          await cmd.unlinkTasks(s.selection.id)
        } else {
          const t = s.tasks[s.selection.id]
          if (!t) return
          const label = t.type === 'group'
            ? `Supprimer le groupe « ${t.title} » et toutes ses tâches ?`
            : `Supprimer « ${t.title} » ?`
          if (!window.confirm(label)) return
          await cmd.deleteTask(t.id)
        }
        s.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

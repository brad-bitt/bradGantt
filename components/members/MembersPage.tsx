'use client'
import { useId, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { MemberRow } from '@/components/project/MemberRow'
import { InviteForm } from '@/components/project/InviteForm'
import { revokeInvitation } from '@/app/(app)/(projet)/projects/[id]/members-actions'
import { ROLE_BADGE, ROLE_LABELS } from '@/lib/projects/roles'
import type { Member } from '@/lib/gantt/types'
import type { PendingInvitation } from '@/lib/invitations/types'

export interface MembersPageProps {
  projectId: string
  members: Member[]
  invitations: PendingInvitation[]
  isOwner: boolean
}

/**
 * Contenu de l'onglet « Membres », repris de l'ancienne fenêtre. Une PAGE et non plus une
 * fenêtre : elle a son URL, se partage, et ne se superpose plus au Gantt qu'elle cachait.
 */
export function MembersPage({ projectId, members, invitations, isOwner }: MembersPageProps) {
  const router = useRouter()
  const titleId = useId()
  const [, start] = useTransition()

  function revoke(id: string) {
    start(async () => {
      const res = await revokeInvitation(projectId, id)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }

  // L'owner en tête, les autres par ordre alphabétique : la liste ne se réordonne pas sous les
  // yeux quand un rôle change.
  const sorted = [...members].sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.displayName.localeCompare(b.displayName)))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section aria-labelledby={titleId} className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        <h2 id={titleId} className="text-3xl">Membres</h2>
        <div className="border-[3px] border-ink bg-paper px-4 shadow-brutal">
          <ul data-testid="members-list" className="divide-y-[3px] divide-ink/10">
            {sorted.map((m) => <MemberRow key={m.userId} member={m} projectId={projectId} isOwner={isOwner} />)}
          </ul>
        </div>
        {isOwner && invitations.length > 0 && (
          <section aria-label="Invitations en attente" className="space-y-2">
            <h3 className="text-lg">Invitations en attente</h3>
            <ul data-testid="pending-list" className="space-y-2">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm">{i.email}</span>
                  <Badge color={ROLE_BADGE[i.role]}>{ROLE_LABELS[i.role]}</Badge>
                  {/* Commande d'objet : niveau 3. « Inviter » reste le seul bouton noir de la page. */}
                  <Button size="sm" variant="quiet" onClick={() => revoke(i.id)}>Révoquer</Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {isOwner && <InviteForm projectId={projectId} />}
      </section>
    </div>
  )
}

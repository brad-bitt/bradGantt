'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useGanttStore } from '@/lib/gantt/store'
import { Dialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { MemberRow } from './MemberRow'
import { InviteForm } from './InviteForm'
import { revokeInvitation } from '@/app/(app)/projects/[id]/members-actions'

export function MembersDialog() {
  const router = useRouter()
  const open = useGanttStore((s) => s.membersDialogOpen)
  const setOpen = useGanttStore((s) => s.setMembersDialogOpen)
  const projectId = useGanttStore((s) => s.projectId)
  const members = useGanttStore((s) => s.members)
  const invitations = useGanttStore((s) => s.invitations)
  const isOwner = useGanttStore((s) => s.myRole === 'owner')
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
    <Dialog open={open} onClose={() => setOpen(false)} title="Membres">
      <ul data-testid="members-list" className="divide-y-[3px] divide-ink/10">
        {sorted.map((m) => <MemberRow key={m.userId} member={m} projectId={projectId} isOwner={isOwner} />)}
      </ul>
      {isOwner && invitations.length > 0 && (
        <section className="mt-4 border-t-[3px] border-ink pt-4">
          <h3 className="text-lg">Invitations en attente</h3>
          <ul data-testid="pending-list" className="mt-2 space-y-2">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <span className="font-mono text-sm flex-1 truncate">{i.email}</span>
                <Badge color="ink">{i.role}</Badge>
                <Button size="sm" variant="secondary" onClick={() => revoke(i.id)}>Révoquer</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isOwner && <div className="mt-4"><InviteForm projectId={projectId} /></div>}
    </Dialog>
  )
}

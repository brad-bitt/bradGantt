'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { toast } from '@/lib/toast/store'
import type { Member } from '@/lib/gantt/types'
import type { InviteRole } from '@/lib/invitations/types'
import { changeMemberRole, removeMember } from '@/app/(app)/projects/[id]/members-actions'

// Mêmes couleurs que les badges de rôle de la liste de projets : un rôle garde sa couleur d'un
// écran à l'autre. Le jaune reste réservé à l'état actif (sélection), il ne code pas un rôle.
const roleColor: Record<Member['role'], BadgeColor> = { owner: 'violet', editor: 'blue', viewer: 'cyan' }

export function MemberRow({ member, projectId, isOwner }: { member: Member; projectId: string; isOwner: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  // La ligne `owner` est intouchable : pas de transfert de propriété dans cette version, et la
  // RLS refuserait de toute façon l'écriture.
  const editable = isOwner && member.role !== 'owner'

  function setRole(role: InviteRole) {
    start(async () => {
      const res = await changeMemberRole(projectId, member.userId, role)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }
  function remove() {
    if (!window.confirm(`Retirer ${member.displayName} du projet ?`)) return
    start(async () => {
      const res = await removeMember(projectId, member.userId)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={member.displayName} color={member.color} src={member.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{member.displayName}</p>
        <p className="font-mono text-xs truncate">{member.email}</p>
      </div>
      <Badge color={roleColor[member.role]}>{member.role}</Badge>
      {editable && (
        <>
          <Select aria-label={`Rôle de ${member.displayName}`} value={member.role} disabled={pending} onChange={(e) => setRole(e.target.value as InviteRole)}
            options={[{ value: 'editor', label: 'Éditeur' }, { value: 'viewer', label: 'Lecteur' }]} className="py-1 text-sm" />
          <Button size="sm" variant="danger-quiet" onClick={remove} disabled={pending}>Retirer</Button>
        </>
      )}
    </li>
  )
}

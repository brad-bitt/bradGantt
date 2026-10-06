'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { toast } from '@/lib/toast/store'
import { ROLE_BADGE, ROLE_LABELS } from '@/lib/projects/roles'
import type { Member } from '@/lib/gantt/types'
import type { InviteRole } from '@/lib/invitations/types'
import { changeMemberRole, removeMember } from '@/app/(app)/(projet)/projects/[id]/members-actions'

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
        <p className="text-xs truncate">{member.email}</p>
      </div>
      {editable ? (
        // Le sélecteur DIT le rôle : un badge à côté répétait la même information.
        <>
          <Select aria-label={`Rôle de ${member.displayName}`} value={member.role} disabled={pending} onChange={(e) => setRole(e.target.value as InviteRole)}
            options={[{ value: 'editor', label: ROLE_LABELS.editor }, { value: 'viewer', label: ROLE_LABELS.viewer }]} className="py-1 text-sm" />
          <Button size="sm" variant="danger-quiet" onClick={remove} disabled={pending}>Retirer</Button>
        </>
      ) : (
        <Badge color={ROLE_BADGE[member.role]}>{ROLE_LABELS[member.role]}</Badge>
      )}
    </li>
  )
}

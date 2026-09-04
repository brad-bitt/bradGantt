'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import type { InviteRole } from '@/lib/invitations/types'

export function InviteForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInviteUrl(null)
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, email, role }),
    })
    const json = (await res.json().catch(() => ({}))) as { kind?: 'added' | 'invited'; inviteUrl?: string; error?: string }
    setBusy(false)
    // Politique d'erreur du projet : un refus prévisible s'affiche INLINE dans le formulaire
    // (« déjà membre », « email invalide »…), là où l'utilisateur peut corriger sa saisie.
    if (!res.ok) { setError(json.error ?? 'Invitation impossible'); return }
    toast.success(json.kind === 'added' ? 'Membre ajouté' : `Invitation envoyée à ${email}`)
    if (json.inviteUrl) setInviteUrl(json.inviteUrl)
    setEmail('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t-[3px] border-ink pt-4">
      <h3 className="text-lg">Inviter</h3>
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} required placeholder="collegue@exemple.fr" />
        <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value as InviteRole)} options={[{ value: 'editor', label: 'Éditeur' }, { value: 'viewer', label: 'Lecteur' }]} />
      </div>
      <Button type="submit" disabled={busy}>Inviter</Button>
      {inviteUrl && (
        // Uniquement en mode test : la route ne renvoie `inviteUrl` que sous `E2E_ENABLED`.
        <p className="bg-yellow border-[3px] border-ink p-2 font-mono text-xs break-all" data-testid="invite-url">
          Lien d&apos;invitation (mode test) : {inviteUrl}
        </p>
      )}
    </form>
  )
}

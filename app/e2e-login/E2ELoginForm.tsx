'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function E2ELoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/projects')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} />
      <Button type="submit">Se connecter</Button>
      {/* Créer un compte à la volée : les tests d'invitation ont besoin d'une adresse qui
          n'existait pas au moment de l'invitation. `enable_confirmations = false` en local,
          le compte est donc confirmé et connecté immédiatement. Cette page entière n'est
          servie que sous `E2E_ENABLED`. */}
      <Button type="button" variant="secondary" onClick={async () => {
        const { error } = await createClient().auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
        if (error) { setError(error.message); return }
        router.push('/projects')
        router.refresh()
      }}>Créer le compte</Button>
    </form>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const callback = () => {
    const url = new URL('/auth/callback', window.location.origin)
    if (next) url.searchParams.set('next', next)
    return url.toString()
  }

  async function withGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })
  }

  async function withMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } })
    setLoading(false)
    if (error) setError("Impossible d'envoyer le lien. Vérifie l'adresse.")
    else setSent(true)
  }

  if (sent) return <p className="rounded-control border border-emerald/40 bg-emerald/20 p-4 text-sm font-medium">Lien envoyé ! Ouvre ta boîte mail ({email}).</p>

  return (
    <div className="space-y-6">
      <Button variant="secondary" className="w-full" onClick={withGoogle}>Continuer avec Google</Button>
      <div className="flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-xs text-ink-soft">ou</span><span className="h-px flex-1 bg-line" /></div>
      <form onSubmit={withMagicLink} className="space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} placeholder="toi@exemple.fr" />
        <Button type="submit" className="w-full" disabled={loading}>Recevoir un lien magique</Button>
      </form>
    </div>
  )
}

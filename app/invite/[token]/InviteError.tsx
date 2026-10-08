import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { switchAccount } from '@/app/invite/actions'

export function InviteError({ kind, token }: { kind: 'mismatch' | 'not_found'; token: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-dialog border border-line bg-surface p-8">
        <h1 className="text-3xl">Invitation</h1>
        {kind === 'mismatch' ? (
          <>
            <p className="font-medium">Cette invitation est destinée à une autre adresse.</p>
            <p>Connecte-toi avec l&apos;adresse email qui a reçu l&apos;invitation.</p>
            <form action={switchAccount.bind(null, `/invite/${token}`)}>
              <Button type="submit">Changer de compte</Button>
            </form>
          </>
        ) : (
          <>
            {/* Un lien déjà utilisé et un lien inexistant donnent le MÊME message : distinguer
                les deux dirait à un inconnu qu'un token a existé. */}
            <p className="font-medium">Lien invalide ou déjà utilisé.</p>
            {/* Seule issue de l'écran : c'en est l'action principale (niveau 1). */}
            <Link href="/projects" className="inline-flex h-10 items-center rounded-control bg-ink px-4 font-medium text-paper focus-ring">Aller à mes projets</Link>
          </>
        )}
      </div>
    </main>
  )
}

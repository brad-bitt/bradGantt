import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { switchAccount } from '@/app/invite/actions'

export function InviteError({ kind, token }: { kind: 'mismatch' | 'not_found'; token: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-paper brutal shadow-brutal-xl p-8 space-y-6">
        <h1 className="text-3xl">Invitation</h1>
        {kind === 'mismatch' ? (
          <>
            <p className="font-bold">Cette invitation est destinée à une autre adresse.</p>
            <p>Connecte-toi avec l&apos;adresse email qui a reçu l&apos;invitation.</p>
            <form action={switchAccount.bind(null, `/invite/${token}`)}>
              <Button type="submit">Changer de compte</Button>
            </form>
          </>
        ) : (
          <>
            {/* Un lien déjà utilisé et un lien inexistant donnent le MÊME message : distinguer
                les deux dirait à un inconnu qu'un token a existé. */}
            <p className="font-bold">Lien invalide ou déjà utilisé.</p>
            <Link href="/projects" className="inline-flex bg-paper brutal brutal-press px-5 py-2 font-bold uppercase brutal-focus">Aller à mes projets</Link>
          </>
        )}
      </div>
    </main>
  )
}

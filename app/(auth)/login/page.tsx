import { LoginForm } from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-paper brutal shadow-brutal-xl p-8 space-y-6">
        {/* Même filet jaune que dans l'en-tête de l'application : on arrive sur la même marque
            qu'on retrouvera une fois connecté. */}
        <h1 className="text-4xl decoration-yellow decoration-4 underline underline-offset-8">BradGantt</h1>
        <p className="font-bold">Des Gantt partagés, brutalement simples.</p>
        {error && <p role="alert" className="bg-danger text-paper border-[3px] border-ink p-3 font-bold">Connexion impossible, réessaie.</p>}
        <LoginForm next={next ?? null} />
      </div>
    </main>
  )
}

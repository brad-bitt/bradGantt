import { LoginForm } from './LoginForm'
import { GanttPreview } from '@/components/layout/GanttPreview'

const ARGUMENTS = [
  { title: 'À plusieurs', body: 'Invite ton équipe, chacun voit la frise bouger.' },
  { title: 'Enchaîné', body: 'Une tâche démarre après l’autre, la flèche le montre.' },
  { title: 'Sans façon', body: 'Glisse une barre. C’est tout. Pas de champ à remplir.' },
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    // Deux colonnes à partir de `lg`, empilées en dessous : le formulaire reste EN PREMIER dans
    // le document, donc en haut sur mobile et premier au clavier. La colonne de droite n'est
    // qu'une vitrine, elle ne doit jamais s'interposer avant le champ de connexion.
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="w-full bg-paper brutal shadow-brutal-xl p-8 space-y-6">
          {/* Même filet jaune que dans l'en-tête de l'application : on arrive sur la même marque
              qu'on retrouvera une fois connecté. */}
          <h1 className="text-4xl decoration-yellow decoration-4 underline underline-offset-8">BradGantt</h1>
          <p className="font-bold">Des Gantt partagés, brutalement simples.</p>
          {error && <p role="alert" className="bg-danger text-paper border-[3px] border-ink p-3 font-bold">Connexion impossible, réessaie.</p>}
          <LoginForm next={next ?? null} />
        </div>

        <div className="space-y-6">
          <GanttPreview />
          <ul className="grid gap-4 sm:grid-cols-3">
            {ARGUMENTS.map((a) => (
              <li key={a.title}>
                <p className="font-display text-sm uppercase">{a.title}</p>
                <p className="font-mono text-xs text-ink-soft">{a.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}

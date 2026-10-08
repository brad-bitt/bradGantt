import { LoginForm } from './LoginForm'
import { GanttPreview } from '@/components/layout/GanttPreview'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Wordmark } from '@/components/layout/Logo'

const ARGUMENTS = [
  { n: '01', title: 'À plusieurs', body: 'Invite ton équipe en lecture ou en écriture. Chacun voit la frise bouger.' },
  { n: '02', title: 'Enchaîné', body: 'Une tâche démarre après l’autre, et la flèche le montre. Un clic suffit.' },
  { n: '03', title: 'Sans façon', body: 'Glisse une barre, tire sur ses bords. Pas de formulaire à remplir.' },
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    // Deux colonnes à partir de `lg`, empilées en dessous : le formulaire reste EN PREMIER dans
    // le document, donc en haut sur mobile et premier au clavier. La colonne de droite n'est
    // qu'une vitrine, elle ne doit jamais s'interposer avant le champ de connexion.
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 pt-20 pb-16 sm:p-6 sm:pt-20 lg:pt-6">
      <ThemeToggle className="absolute right-6 top-6" />
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
        <div className="w-full space-y-6 rounded-dialog border border-line bg-surface p-8">
          {/* Même signe et même nom que dans l'en-tête : on arrive sur la marque qu'on
              retrouvera une fois connecté. */}
          <h1><Wordmark size="lg" /></h1>
          <p className="font-medium">Connecte-toi pour retrouver tes projets.</p>
          {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger/8 p-3 text-sm font-medium text-danger">Connexion impossible, réessaie.</p>}
          <LoginForm next={next ?? null} />
        </div>

        <div className="space-y-8">
          {/* Le titre porte la promesse, en Fraunces et sur deux lignes : c'est la seule fois où
              le site parle de lui, autant que ça se voie. */}
          <h2 className="text-3xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Des Gantt partagés,
            <br />
            simplement.
          </h2>
          <GanttPreview />
          <ol className="grid gap-4 sm:grid-cols-3">
            {ARGUMENTS.map((a) => (
              <li key={a.n} className="space-y-2 rounded-card border border-line bg-surface p-4">
                <span className="font-mono text-xs text-ink-soft">{a.n}</span>
                <p className="font-display text-lg font-medium">{a.title}</p>
                <p className="text-sm">{a.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-5 text-center text-xs text-ink-soft">
        BradGantt — diagrammes de Gantt collaboratifs, en temps réel.
      </p>
    </main>
  )
}

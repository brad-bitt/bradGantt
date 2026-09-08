import { LoginForm } from './LoginForm'
import { GanttPreview } from '@/components/layout/GanttPreview'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

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
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 pb-16">
      <ThemeToggle className="absolute right-6 top-6" />
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
        <div className="w-full bg-paper brutal shadow-brutal-xl p-8 space-y-6">
          {/* Même filet jaune que dans l'en-tête de l'application : on arrive sur la même marque
              qu'on retrouvera une fois connecté. */}
          <h1 className="text-4xl decoration-yellow decoration-4 underline underline-offset-8">BradGantt</h1>
          <p className="font-bold">Connecte-toi pour retrouver tes projets.</p>
          {error && <p role="alert" className="bg-danger text-on-data border-[3px] border-ink p-3 font-bold">Connexion impossible, réessaie.</p>}
          <LoginForm next={next ?? null} />
        </div>

        <div className="space-y-8">
          {/* Le titre porte la promesse, en caractères d'affichage et sur trois lignes : c'est
              la seule fois où le site parle de lui, autant que ça se voie. Le mot-clé est
              souligné du filet jaune de la marque, pas d'un aplat. */}
          <h2 className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Des Gantt partagés,
            <br />
            <span className="decoration-yellow decoration-[6px] underline underline-offset-8">brutalement</span> simples.
          </h2>
          <GanttPreview />
          <ol className="grid gap-4 sm:grid-cols-3">
            {ARGUMENTS.map((a) => (
              <li key={a.n} className="bg-paper brutal p-4 space-y-2">
                <span className="font-mono text-xs text-ink-soft">{a.n}</span>
                <p className="font-display text-base uppercase">{a.title}</p>
                <p className="text-sm">{a.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-5 text-center font-mono text-xs text-ink-soft">
        BradGantt — diagrammes de Gantt collaboratifs, en temps réel.
      </p>
    </main>
  )
}

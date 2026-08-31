import { createClient } from '@/lib/supabase/server'
import { ProjectCard, type ProjectListItem } from '@/components/project/ProjectCard'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('projects')
    .select('id, name, created_at, memberships!inner(role, user_id)')
    .eq('memberships.user_id', user!.id)
    .order('created_at', { ascending: false })

  const projects: ProjectListItem[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    role: p.memberships[0].role,
  }))

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Mes projets</h1>
        <NewProjectDialog />
      </div>
      {projects.length === 0 ? (
        <p className="bg-paper brutal p-6 font-bold">Aucun projet. Crée le premier !</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <li key={p.id}><ProjectCard project={p} /></li>)}
        </ul>
      )}
    </main>
  )
}

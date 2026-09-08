export type Role = 'owner' | 'editor' | 'viewer'
export type TaskType = 'task' | 'milestone' | 'group'
export type Zoom = 'day' | 'week' | 'month'

export interface Task {
  id: string
  projectId: string
  parentId: string | null
  title: string
  type: TaskType
  startDate: string // 'yyyy-MM-dd'
  endDate: string // 'yyyy-MM-dd', inclusif
  progress: number // 0..100
  color: string
  assigneeId: string | null
  sortOrder: number
  collapsed: boolean
  updatedAt: string // ISO datetime
}

export interface Dependency {
  id: string
  projectId: string
  fromTaskId: string
  toTaskId: string
}

export interface Member {
  userId: string
  role: Role
  displayName: string
  email: string
  avatarUrl: string | null
  color: string
}

export interface GanttData {
  tasks: Record<string, Task>
  dependencies: Record<string, Dependency>
}

export interface Range { start: string; end: string } // bornes inclusives
export interface Rect { x: number; y: number; width: number; height: number }

export interface Row { task: Task; depth: 0 | 1; index: number }

export type DragState =
  | { mode: 'move' | 'resize-start' | 'resize-end'; taskId: string; deltaDays: number }
  | { mode: 'link'; fromTaskId: string; x: number; y: number }
  | { mode: 'reorder'; taskId: string; targetIndex: number }

export type Selection = { kind: 'task'; id: string } | { kind: 'dependency'; id: string } | null

export type EditorState =
  | { mode: 'edit'; taskId: string }
  /**
   * `afterTaskId` : la tâche est ENCHAÎNÉE après celle-ci — dates pré-remplies au lendemain de
   * sa fin, rang juste après elle dans la fratrie, et proposition de dépendance. `null` pour
   * une création ordinaire, qui atterrit en fin de liste.
   */
  | { mode: 'create'; parentId: string | null; type: TaskType; afterTaskId?: string | null }
  | null

'use client'
import { SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'
import { SidebarRow } from './SidebarRow'

export function Sidebar() {
  const { layout } = useGanttView()
  return (
    <div className="sticky left-0 z-20 border-r-[3px] border-ink bg-paper" style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}>
      {layout.rows.map((row) => <SidebarRow key={row.task.id} row={row} />)}
    </div>
  )
}

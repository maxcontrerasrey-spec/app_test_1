import type { ResolvedWidget } from "../../types";

export function TasksWidget({ widget, dashboardData }: { widget: ResolvedWidget, dashboardData?: any }) {
  const tasks = dashboardData?.tasksData || [];

  return (
    <article className="widget-card widget-tasks" style={{ height: '100%' }}>
      <div className="widget-header">
        <h3 className="widget-title">{widget.name}</h3>
        <button className="widget-menu-btn" title="Options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <div className="nx-table-wrapper">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Elemento ({tasks.length})</th>
              <th>Estado</th>
              <th className="nx-td-numeric">Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Excelente, no tienes tareas pendientes.
                </td>
              </tr>
            ) : (
              tasks.map((task: any) => {
                // Determine color based on priority
                const priorityColor = task.priority === 'Alta' ? 'var(--color-warning)' : 
                                      task.priority === 'Crítica' ? 'var(--color-danger)' : 'var(--text-muted)';
                
                // Determine dot class based on status
                const dotClass = task.status_code === 'pending' ? 'pending' : 
                                 task.status_code === 'sourcing' ? 'running' : 'healthy';

                return (
                  <tr key={task.id}>
                    <td className="nx-td-primary" title={task.title}>
                      {task.title}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                        {task.subtitle}
                      </div>
                    </td>
                    <td>
                      <span className="nx-status">
                        <span className={`nx-dot ${dotClass}`}></span> {task.status_label}
                      </span>
                    </td>
                    <td className="nx-td-numeric" style={{ color: priorityColor }}>{task.priority}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

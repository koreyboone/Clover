import type { ReactNode } from 'react';

const TASK_STATUS_LABELS: Record<string, string> = {
  incomplete: 'To do',
  awaiting_verification: 'Waiting for a parent',
  complete: 'Done',
  assisted: 'Done with help',
};

export function getTaskStatusLabel(status: string) {
  return TASK_STATUS_LABELS[status] ?? status;
}

export function TaskStatusBadge({ status }: { status: string }) {
  return (
    <span className="task-status" data-status={status}>
      {getTaskStatusLabel(status)}
    </span>
  );
}

export function StatusMessage({
  children,
  tone = 'neutral',
  role = 'status',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'offline' | 'success' | 'error';
  role?: 'status' | 'alert';
}) {
  return (
    <p className={`notice notice--${tone}`} role={role}>
      {children}
    </p>
  );
}

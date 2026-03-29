export interface SuperProductivityTask {
  id: string;
  title: string;
  isDone: boolean;
  timeEstimate?: number;
  timeSpent: number;
  projectId?: string;
  notes?: string;
  created: number;
  doneOn?: number;
  subTaskIds?: string[];
  dueDay?: string;
  dueWithTime?: number;
  remindAt?: number;
  deadlineDay?: string;
  deadlineWithTime?: number;
  deadlineRemindAt?: number;
  [key: string]: unknown;
}

export interface SuperProductivityProject {
  id: string;
  title: string;
  isArchived?: boolean;
  [key: string]: unknown;
}

export interface SuperProductivityTag {
  id: string;
  title: string;
  color?: string;
  icon?: string;
  [key: string]: unknown;
}

export interface TaskSchedulingInput {
  startAt?: string | number | null;
  startDate?: string | null;
  remindAt?: string | number | null;
  deadlineAt?: string | number | null;
  deadlineDate?: string | null;
  deadlineRemindAt?: string | number | null;
}

export interface CreateTaskInput extends TaskSchedulingInput {
  title: string;
  projectId?: string;
  notes?: string;
  timeEstimate?: number;
  tagIds?: string[];
  parentId?: string;
}

export interface UpdateTaskInput extends TaskSchedulingInput {
  title?: string;
  notes?: string;
  timeEstimate?: number;
  isDone?: boolean;
  projectId?: string;
}

export interface TaskBatchOperation {
  type: "create" | "update" | "delete" | "reorder";
  taskId?: string;
  tempId?: string;
  data?: Record<string, unknown>;
  updates?: Record<string, unknown>;
  taskIds?: string[];
}

export interface ProjectCreateInput {
  title: string;
  theme?: Record<string, unknown>;
  isArchived?: boolean;
}

export interface TagCreateInput {
  title: string;
  color?: string;
  icon?: string;
}

export interface TagUpdateInput {
  title?: string;
  color?: string;
  icon?: string;
}

export type NotificationType = "SUCCESS" | "ERROR" | "INFO";

export interface NotificationInput {
  message: string;
  type?: NotificationType;
  duration?: number;
}

export interface SnackInput {
  message: string;
  type?: NotificationType;
  config?: Record<string, unknown>;
}

export interface DialogInput {
  type?: "CONFIRM" | "PROMPT";
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export interface ListedTask {
  id: string;
  title: string;
  isDone: boolean;
  timeEstimate?: number;
  timeSpent: number;
  projectId?: string;
  notes?: string;
  startDate: string | null;
  startAt: string | null;
  startAtMs: number | null;
  remindAt: string | null;
  remindAtMs: number | null;
  deadlineDate: string | null;
  deadlineAt: string | null;
  deadlineAtMs: number | null;
  deadlineRemindAt: string | null;
  deadlineRemindAtMs: number | null;
}

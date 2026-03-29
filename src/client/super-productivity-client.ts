import type {
  CreateTaskInput,
  DialogInput,
  NotificationInput,
  ProjectCreateInput,
  SnackInput,
  SuperProductivityProject,
  SuperProductivityTag,
  SuperProductivityTask,
  TagCreateInput,
  TagUpdateInput,
  TaskBatchOperation,
  UpdateTaskInput,
} from "../types/super-productivity.js";

export interface SuperProductivityClient {
  getTasks(): Promise<SuperProductivityTask[]>;
  getCurrentContextTasks(): Promise<SuperProductivityTask[]>;
  createTask(taskData: Record<string, unknown> | CreateTaskInput): Promise<string>;
  updateTask(taskId: string, updates: Record<string, unknown> | UpdateTaskInput): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  batchUpdate(projectId: string, operations: TaskBatchOperation[]): Promise<unknown>;
  getProjects(): Promise<SuperProductivityProject[]>;
  createProject(projectData: ProjectCreateInput): Promise<string>;
  getTags(): Promise<SuperProductivityTag[]>;
  createTag(tagData: TagCreateInput): Promise<string>;
  updateTag(tagId: string, updates: TagUpdateInput): Promise<void>;
  notify(config: NotificationInput): Promise<void>;
  showSnack(config: SnackInput): Promise<void>;
  openDialog(config: DialogInput): Promise<unknown>;
}

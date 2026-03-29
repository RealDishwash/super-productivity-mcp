import type { Socket } from "socket.io";
import type {
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
} from "../types/super-productivity.js";
import type { SuperProductivityClient } from "./super-productivity-client.js";

const SOCKET_ACK_TIMEOUT_MS = 10_000;

export class SocketSuperProductivityClient implements SuperProductivityClient {
  private socket: Socket | null = null;

  setSocket(socket: Socket | null): void {
    this.socket = socket;
  }

  getSocketId(): string | null {
    return this.socket?.id ?? null;
  }

  async getTasks(): Promise<SuperProductivityTask[]> {
    return this.emitWithAck<SuperProductivityTask[]>("tasks:get");
  }

  async getCurrentContextTasks(): Promise<SuperProductivityTask[]> {
    return this.emitWithAck<SuperProductivityTask[]>("tasks:getCurrent");
  }

  async createTask(taskData: Record<string, unknown>): Promise<string> {
    return this.emitWithAck<string>("tasks:create", taskData);
  }

  async updateTask(taskId: string, updates: Record<string, unknown>): Promise<void> {
    await this.emitWithAck("tasks:update", { taskId, updates });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.emitWithAck("tasks:delete", { taskId });
  }

  async batchUpdate(projectId: string, operations: TaskBatchOperation[]): Promise<unknown> {
    return this.emitWithAck("tasks:batch", { projectId, operations });
  }

  async getProjects(): Promise<SuperProductivityProject[]> {
    return this.emitWithAck<SuperProductivityProject[]>("projects:get");
  }

  async createProject(projectData: ProjectCreateInput): Promise<string> {
    return this.emitWithAck<string>("projects:create", projectData);
  }

  async getTags(): Promise<SuperProductivityTag[]> {
    return this.emitWithAck<SuperProductivityTag[]>("tags:get");
  }

  async createTag(tagData: TagCreateInput): Promise<string> {
    return this.emitWithAck<string>("tags:create", tagData);
  }

  async updateTag(tagId: string, updates: TagUpdateInput): Promise<void> {
    await this.emitWithAck("tags:update", { tagId, updates });
  }

  async notify(config: NotificationInput): Promise<void> {
    await this.emitWithAck("ui:notify", config);
  }

  async showSnack(config: SnackInput): Promise<void> {
    await this.emitWithAck("ui:showSnack", config);
  }

  async openDialog(config: DialogInput): Promise<unknown> {
    return this.emitWithAck("ui:openDialog", config);
  }

  private async emitWithAck<T>(event: string, data?: unknown): Promise<T> {
    if (!this.socket) {
      throw new Error(
        "Super Productivity plugin is not connected. Verify the bridge plugin is installed and active.",
      );
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for plugin response for event: ${event}`));
      }, SOCKET_ACK_TIMEOUT_MS);

      this.socket!.emit(event, data, (response: unknown) => {
        clearTimeout(timeout);

        if (isSocketErrorResponse(response)) {
          reject(new Error(response.error));
          return;
        }

        resolve(response as T);
      });
    });
  }
}

function isSocketErrorResponse(response: unknown): response is { error: string } {
  return (
    typeof response === "object" &&
    response !== null &&
    "error" in response &&
    typeof (response as { error?: unknown }).error === "string"
  );
}

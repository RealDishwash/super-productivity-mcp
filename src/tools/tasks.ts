import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import type {
  SuperProductivityProject,
  SuperProductivityTask,
  TaskBatchOperation,
} from "../types/super-productivity.js";
import {
  getTaskDeadlineTimestamp,
  isoDateField,
  isoDatetimeField,
  normalizeTaskPayload,
  serializeTask,
} from "./task-mapper.js";
import { handleJsonTool } from "./tool-response.js";

const batchOperationSchema = z.object({
  type: z.enum(["create", "update", "delete", "reorder"]),
  taskId: z.string().optional(),
  tempId: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  updates: z.record(z.unknown()).optional(),
  taskIds: z.array(z.string()).optional(),
});

export function setupTaskTools(server: McpServer, client: SuperProductivityClient): void {
  server.tool(
    "get_task",
    {
      taskId: z.string().describe("Task ID to look up"),
    },
    async ({ taskId }) =>
      handleJsonTool(async () => {
        const tasks = await client.getTasks();
        const task = tasks.find((candidate) => candidate.id === taskId);

        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }

        return {
          task: serializeTask(task),
        };
      }),
  );

  server.tool(
    "list_tasks",
    {
      projectId: z.string().optional(),
      includeArchived: z.boolean().default(false),
      currentContextOnly: z.boolean().default(false),
    },
    async ({ projectId, includeArchived, currentContextOnly }) =>
      handleJsonTool(async () => {
        const tasks = currentContextOnly
          ? await client.getCurrentContextTasks()
          : await client.getTasks();

        let filteredTasks = tasks;
        if (!includeArchived) {
          const projects = await client.getProjects();
          const archivedProjectIds = new Set(
            projects.filter((project) => project.isArchived).map((project) => project.id),
          );

          filteredTasks = filteredTasks.filter(
            (task) => !task.projectId || !archivedProjectIds.has(task.projectId),
          );
        }

        if (projectId) {
          filteredTasks = filteredTasks.filter((task) => task.projectId === projectId);
        }

        return {
          count: filteredTasks.length,
          tasks: filteredTasks.map(serializeTask),
        };
      }),
  );

  server.tool(
    "search_tasks",
    {
      query: z.string().optional().describe("Case-insensitive text search across title and notes"),
      projectId: z.string().optional().describe("Filter by project ID"),
      tagId: z.string().optional().describe("Filter by tag ID"),
      isDone: z.boolean().optional().describe("Filter by completion status"),
      overdue: z.boolean().optional().describe("Filter overdue tasks"),
      hasDeadline: z.boolean().optional().describe("Filter tasks that have a deadline"),
      hasEstimate: z.boolean().optional().describe("Filter tasks that have a time estimate"),
      includeArchived: z.boolean().default(false),
      currentContextOnly: z.boolean().default(false),
      limit: z.number().int().positive().max(200).optional().describe("Maximum number of results"),
    },
    async (filters) =>
      handleJsonTool(async () => {
        const tasks = filters.currentContextOnly
          ? await client.getCurrentContextTasks()
          : await client.getTasks();

        const archivedProjectIds = filters.includeArchived
          ? new Set<string>()
          : await getArchivedProjectIds(client);

        const normalizedQuery = filters.query?.trim().toLowerCase();
        const now = Date.now();

        const filteredTasks = tasks
          .filter((task) => {
            if (!filters.includeArchived && task.projectId && archivedProjectIds.has(task.projectId)) {
              return false;
            }

            if (filters.projectId && task.projectId !== filters.projectId) {
              return false;
            }

            if (typeof filters.isDone === "boolean" && task.isDone !== filters.isDone) {
              return false;
            }

            if (typeof filters.hasEstimate === "boolean") {
              const hasEstimate = typeof task.timeEstimate === "number" && Number.isFinite(task.timeEstimate);
              if (hasEstimate !== filters.hasEstimate) {
                return false;
              }
            }

            if (typeof filters.hasDeadline === "boolean") {
              const hasDeadline = getTaskDeadlineTimestamp(task) !== null;
              if (hasDeadline !== filters.hasDeadline) {
                return false;
              }
            }

            if (typeof filters.overdue === "boolean") {
              const deadlineTimestamp = getTaskDeadlineTimestamp(task);
              const isOverdue = !task.isDone && deadlineTimestamp !== null && deadlineTimestamp < now;
              if (isOverdue !== filters.overdue) {
                return false;
              }
            }

            if (filters.tagId && !getTaskTagIds(task).includes(filters.tagId)) {
              return false;
            }

            if (normalizedQuery) {
              const haystack = `${task.title} ${task.notes ?? ""}`.toLowerCase();
              if (!haystack.includes(normalizedQuery)) {
                return false;
              }
            }

            return true;
          })
          .slice(0, filters.limit);

        return {
          count: filteredTasks.length,
          appliedFilters: {
            ...filters,
            query: normalizedQuery ?? undefined,
          },
          tasks: filteredTasks.map(serializeTask),
        };
      }),
  );

  server.tool(
    "create_task",
    {
      title: z.string().describe("Task title"),
      projectId: z.string().optional().describe("Project ID to add task to"),
      notes: z.string().optional().describe("Task notes/description"),
      timeEstimate: z.number().optional().describe("Time estimate in milliseconds"),
      tagIds: z.array(z.string()).optional().describe("Array of tag IDs"),
      parentId: z.string().optional().describe("Parent task ID for subtasks"),
      startAt: isoDatetimeField.optional().describe(
        "Scheduled start as ISO datetime or Unix ms, e.g. 2026-03-26T09:00:00+11:00",
      ),
      startDate: isoDateField.optional().describe("Scheduled all-day start as YYYY-MM-DD"),
      remindAt: isoDatetimeField.optional().describe("Reminder time as ISO datetime or Unix ms"),
      deadlineAt: isoDatetimeField.optional().describe(
        "Deadline with time as ISO datetime or Unix ms",
      ),
      deadlineDate: isoDateField.optional().describe("Deadline date as YYYY-MM-DD"),
      deadlineRemindAt: isoDatetimeField.optional().describe(
        "Deadline reminder time as ISO datetime or Unix ms",
      ),
    },
    async (params) =>
      handleJsonTool(async () => {
        const taskId = await client.createTask(normalizeTaskPayload(params));
        return {
          success: true,
          taskId,
          message: `Task created: ${params.title}`,
        };
      }),
  );

  server.tool(
    "update_task",
    {
      taskId: z.string().describe("Task ID to update"),
      title: z.string().optional(),
      notes: z.string().optional(),
      timeEstimate: z.number().optional(),
      isDone: z.boolean().optional(),
      projectId: z.string().optional(),
      startAt: isoDatetimeField.optional().describe(
        "Scheduled start as ISO datetime or Unix ms; use null to clear",
      ),
      startDate: isoDateField.optional().describe(
        "Scheduled all-day start as YYYY-MM-DD; use null to clear",
      ),
      remindAt: isoDatetimeField.optional().describe(
        "Reminder time as ISO datetime or Unix ms; use null to clear",
      ),
      deadlineAt: isoDatetimeField.optional().describe(
        "Deadline with time as ISO datetime or Unix ms; use null to clear",
      ),
      deadlineDate: isoDateField.optional().describe(
        "Deadline date as YYYY-MM-DD; use null to clear",
      ),
      deadlineRemindAt: isoDatetimeField.optional().describe(
        "Deadline reminder time as ISO datetime or Unix ms; use null to clear",
      ),
    },
    async ({ taskId, ...updates }) =>
      handleJsonTool(async () => {
        await client.updateTask(taskId, normalizeTaskPayload(updates));
        return {
          success: true,
          message: "Task updated successfully",
        };
      }),
  );

  server.tool(
    "complete_task",
    {
      taskId: z.string().describe("Task ID to complete"),
    },
    async ({ taskId }) =>
      handleJsonTool(async () => {
        await client.updateTask(taskId, { isDone: true });
        return {
          success: true,
          message: "Task marked as complete",
        };
      }),
  );

  server.tool(
    "delete_task",
    {
      taskId: z.string().describe("Task ID to delete"),
    },
    async ({ taskId }) =>
      handleJsonTool(async () => {
        await client.deleteTask(taskId);
        return {
          success: true,
          message: "Task deleted successfully",
        };
      }),
  );

  server.tool(
    "batch_update_tasks",
    {
      projectId: z.string().describe("Project ID for batch operations"),
      operations: z.array(batchOperationSchema),
    },
    async ({ projectId, operations }) =>
      handleJsonTool(async () => {
        return client.batchUpdate(projectId, operations as TaskBatchOperation[]);
      }),
  );
}

async function getArchivedProjectIds(client: SuperProductivityClient): Promise<Set<string>> {
  const projects = await client.getProjects();
  return new Set(getArchivedProjects(projects).map((project) => project.id));
}

function getArchivedProjects(projects: SuperProductivityProject[]): SuperProductivityProject[] {
  return projects.filter((project) => project.isArchived);
}

function getTaskTagIds(task: SuperProductivityTask): string[] {
  const { tagIds } = task as SuperProductivityTask & { tagIds?: unknown };
  return Array.isArray(tagIds) ? tagIds.filter((tagId): tagId is string => typeof tagId === "string") : [];
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import type { TaskBatchOperation } from "../types/super-productivity.js";
import {
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

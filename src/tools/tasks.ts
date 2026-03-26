import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SuperProductivityClient } from '../client/sp-client.js';

const isoDatetimeField = z.union([z.string(), z.number(), z.null()]);
const isoDateField = z.union([z.string(), z.null()]);

export function setupTaskTools(server: McpServer, client: SuperProductivityClient) {
  // Tool: Listar tarefas
  server.tool(
    'list_tasks',
    {
      projectId: z.string().optional(),
      includeArchived: z.boolean().default(false),
      currentContextOnly: z.boolean().default(false)
    },
    async ({ projectId, includeArchived, currentContextOnly }) => {
      try {
        const tasks = currentContextOnly
          ? await client.getCurrentContextTasks()
          : await client.getTasks();

        let filteredTasks = tasks;
        if (projectId) {
          filteredTasks = tasks.filter(t => t.projectId === projectId);
        }

        const output = {
          count: filteredTasks.length,
          tasks: filteredTasks.map(t => ({
            id: t.id,
            title: t.title,
            isDone: t.isDone,
            timeEstimate: t.timeEstimate,
            timeSpent: t.timeSpent,
            projectId: t.projectId,
            notes: t.notes,
            startDate: t.dueDay ?? null,
            startAt: toIsoDateTime(t.dueWithTime),
            startAtMs: t.dueWithTime ?? null,
            remindAt: toIsoDateTime(t.remindAt),
            remindAtMs: t.remindAt ?? null,
            deadlineDate: t.deadlineDay ?? null,
            deadlineAt: toIsoDateTime(t.deadlineWithTime),
            deadlineAtMs: t.deadlineWithTime ?? null,
            deadlineRemindAt: toIsoDateTime(t.deadlineRemindAt),
            deadlineRemindAtMs: t.deadlineRemindAt ?? null
          }))
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool: Criar tarefa
  server.tool(
    'create_task',
    {
      title: z.string().describe('Task title'),
      projectId: z.string().optional().describe('Project ID to add task to'),
      notes: z.string().optional().describe('Task notes/description'),
      timeEstimate: z.number().optional().describe('Time estimate in milliseconds'),
      tagIds: z.array(z.string()).optional().describe('Array of tag IDs'),
      parentId: z.string().optional().describe('Parent task ID for subtasks'),
      startAt: isoDatetimeField.optional().describe('Scheduled start as ISO datetime or Unix ms, e.g. 2026-03-26T09:00:00+11:00'),
      startDate: isoDateField.optional().describe('Scheduled all-day start as YYYY-MM-DD'),
      remindAt: isoDatetimeField.optional().describe('Reminder time as ISO datetime or Unix ms'),
      deadlineAt: isoDatetimeField.optional().describe('Deadline with time as ISO datetime or Unix ms'),
      deadlineDate: isoDateField.optional().describe('Deadline date as YYYY-MM-DD'),
      deadlineRemindAt: isoDatetimeField.optional().describe('Deadline reminder time as ISO datetime or Unix ms')
    },
    async (params) => {
      try {
        const taskId = await client.createTask(normalizeTaskPayload(params));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              taskId,
              message: `Task created: ${params.title}`
            })
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool: Atualizar tarefa
  server.tool(
    'update_task',
    {
      taskId: z.string().describe('Task ID to update'),
      title: z.string().optional(),
      notes: z.string().optional(),
      timeEstimate: z.number().optional(),
      isDone: z.boolean().optional(),
      projectId: z.string().optional(),
      startAt: isoDatetimeField.optional().describe('Scheduled start as ISO datetime or Unix ms; use null to clear'),
      startDate: isoDateField.optional().describe('Scheduled all-day start as YYYY-MM-DD; use null to clear'),
      remindAt: isoDatetimeField.optional().describe('Reminder time as ISO datetime or Unix ms; use null to clear'),
      deadlineAt: isoDatetimeField.optional().describe('Deadline with time as ISO datetime or Unix ms; use null to clear'),
      deadlineDate: isoDateField.optional().describe('Deadline date as YYYY-MM-DD; use null to clear'),
      deadlineRemindAt: isoDatetimeField.optional().describe('Deadline reminder time as ISO datetime or Unix ms; use null to clear')
    },
    async ({ taskId, ...updates }) => {
      try {
        await client.updateTask(taskId, normalizeTaskPayload(updates));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Task updated successfully'
            })
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool: Completar tarefa
  server.tool(
    'complete_task',
    {
      taskId: z.string().describe('Task ID to complete')
    },
    async ({ taskId }) => {
      try {
        await client.updateTask(taskId, { isDone: true });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Task marked as complete'
            })
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool: Batch operations
  server.tool(
    'batch_update_tasks',
    {
      projectId: z.string().describe('Project ID for batch operations'),
      operations: z.array(z.object({
        type: z.enum(['create', 'update', 'delete', 'reorder']),
        taskId: z.string().optional(),
        tempId: z.string().optional(),
        data: z.record(z.any()).optional(),
        updates: z.record(z.any()).optional(),
        taskIds: z.array(z.string()).optional()
      }))
    },
    async ({ projectId, operations }) => {
      try {
        const result = await client.batchUpdate(projectId, operations);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}

function normalizeTaskPayload<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...params };
  const hasStartAt = Object.prototype.hasOwnProperty.call(params, 'startAt');
  const hasStartDate = Object.prototype.hasOwnProperty.call(params, 'startDate');
  const hasRemindAt = Object.prototype.hasOwnProperty.call(params, 'remindAt');
  const hasDeadlineAt = Object.prototype.hasOwnProperty.call(params, 'deadlineAt');
  const hasDeadlineDate = Object.prototype.hasOwnProperty.call(params, 'deadlineDate');
  const hasDeadlineRemindAt = Object.prototype.hasOwnProperty.call(params, 'deadlineRemindAt');

  if (hasStartAt && hasStartDate) {
    throw new Error('Use either startAt or startDate, not both');
  }

  if (hasDeadlineAt && hasDeadlineDate) {
    throw new Error('Use either deadlineAt or deadlineDate, not both');
  }

  if (hasStartAt) {
    normalized.dueWithTime = parseDateTimeInput(params.startAt, 'startAt');
    normalized.dueDay = null;
    delete normalized.startAt;
  }

  if (hasStartDate) {
    normalized.dueDay = parseDateInput(params.startDate, 'startDate');
    normalized.dueWithTime = null;
    delete normalized.startDate;
  }

  if (hasRemindAt) {
    normalized.remindAt = parseDateTimeInput(params.remindAt, 'remindAt');
  }

  if (hasDeadlineAt) {
    normalized.deadlineWithTime = parseDateTimeInput(params.deadlineAt, 'deadlineAt');
    normalized.deadlineDay = null;
    delete normalized.deadlineAt;
  }

  if (hasDeadlineDate) {
    normalized.deadlineDay = parseDateInput(params.deadlineDate, 'deadlineDate');
    normalized.deadlineWithTime = null;
    delete normalized.deadlineDate;
  }

  if (hasDeadlineRemindAt) {
    normalized.deadlineRemindAt = parseDateTimeInput(params.deadlineRemindAt, 'deadlineRemindAt');
  }

  delete normalized.startAt;
  delete normalized.startDate;
  delete normalized.deadlineAt;
  delete normalized.deadlineDate;
  return normalized;
}

function parseDateTimeInput(value: unknown, field: string): number | null {
  if (value === undefined) {
    throw new Error(`${field} must be provided`);
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} must be a valid Unix timestamp in milliseconds`);
    }
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be an ISO datetime string, Unix timestamp in milliseconds, or null`);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be a valid ISO datetime string or Unix timestamp in milliseconds`);
  }

  return parsed;
}

function parseDateInput(value: unknown, field: string): string | null {
  if (value === undefined) {
    throw new Error(`${field} must be provided`);
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a date string in YYYY-MM-DD format or null`);
  }

  return value;
}

function toIsoDateTime(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

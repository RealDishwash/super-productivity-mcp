import { z } from "zod";
import type {
  ListedTask,
  SuperProductivityTask,
} from "../types/super-productivity.js";

export const isoDatetimeField = z.union([z.string(), z.number(), z.null()]);
export const isoDateField = z.union([z.string(), z.null()]);

type TaskPayloadInput = Record<string, unknown>;

export function serializeTask(task: SuperProductivityTask): ListedTask {
  return {
    id: task.id,
    title: task.title,
    isDone: task.isDone,
    timeEstimate: task.timeEstimate,
    timeSpent: task.timeSpent,
    projectId: task.projectId,
    notes: task.notes,
    startDate: task.dueDay ?? null,
    startAt: toIsoDateTime(task.dueWithTime),
    startAtMs: task.dueWithTime ?? null,
    remindAt: toIsoDateTime(task.remindAt),
    remindAtMs: task.remindAt ?? null,
    deadlineDate: task.deadlineDay ?? null,
    deadlineAt: toIsoDateTime(task.deadlineWithTime),
    deadlineAtMs: task.deadlineWithTime ?? null,
    deadlineRemindAt: toIsoDateTime(task.deadlineRemindAt),
    deadlineRemindAtMs: task.deadlineRemindAt ?? null,
  };
}

export function normalizeTaskPayload<T extends TaskPayloadInput>(params: T): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...params };

  const hasStartAt = hasOwnProperty(params, "startAt");
  const hasStartDate = hasOwnProperty(params, "startDate");
  const hasRemindAt = hasOwnProperty(params, "remindAt");
  const hasDeadlineAt = hasOwnProperty(params, "deadlineAt");
  const hasDeadlineDate = hasOwnProperty(params, "deadlineDate");
  const hasDeadlineRemindAt = hasOwnProperty(params, "deadlineRemindAt");

  if (hasNonNullProperty(params, "startAt") && hasNonNullProperty(params, "startDate")) {
    throw new Error("Use either startAt or startDate, not both");
  }

  if (hasNonNullProperty(params, "deadlineAt") && hasNonNullProperty(params, "deadlineDate")) {
    throw new Error("Use either deadlineAt or deadlineDate, not both");
  }

  if (hasStartAt) {
    normalized.dueWithTime = parseDateTimeInput(params.startAt, "startAt");
    if (params.startAt !== null) {
      delete normalized.dueDay;
    }
  }

  if (hasStartDate) {
    normalized.dueDay = parseDateInput(params.startDate, "startDate");
    if (params.startDate !== null) {
      delete normalized.dueWithTime;
    }
  }

  if (hasRemindAt) {
    normalized.remindAt = parseDateTimeInput(params.remindAt, "remindAt");
  }

  if (hasDeadlineAt) {
    normalized.deadlineWithTime = parseDateTimeInput(params.deadlineAt, "deadlineAt");
    if (params.deadlineAt !== null) {
      delete normalized.deadlineDay;
    }
  }

  if (hasDeadlineDate) {
    normalized.deadlineDay = parseDateInput(params.deadlineDate, "deadlineDate");
    if (params.deadlineDate !== null) {
      delete normalized.deadlineWithTime;
    }
  }

  if (hasDeadlineRemindAt) {
    normalized.deadlineRemindAt = parseDateTimeInput(params.deadlineRemindAt, "deadlineRemindAt");
  }

  delete normalized.startAt;
  delete normalized.startDate;
  delete normalized.deadlineAt;
  delete normalized.deadlineDate;

  return normalized;
}

export function getTaskDeadlineTimestamp(task: Pick<SuperProductivityTask, "deadlineWithTime" | "deadlineDay"> & {
  dueDate?: unknown;
}): number | null {
  if (typeof task.deadlineWithTime === "number" && Number.isFinite(task.deadlineWithTime)) {
    return task.deadlineWithTime;
  }

  if (typeof task.deadlineDay === "string") {
    const parsed = Date.parse(`${task.deadlineDay}T23:59:59.999`);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof task.dueDate === "number" && Number.isFinite(task.dueDate)) {
    return task.dueDate;
  }

  return null;
}

function parseDateTimeInput(value: unknown, field: string): number | null {
  if (value === undefined) {
    throw new Error(`${field} must be provided`);
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} must be a valid Unix timestamp in milliseconds`);
    }
    return value;
  }

  if (typeof value !== "string") {
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

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a date string in YYYY-MM-DD format or null`);
  }

  return value;
}

function toIsoDateTime(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

function hasOwnProperty(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function hasNonNullProperty(object: Record<string, unknown>, key: string): boolean {
  return hasOwnProperty(object, key) && object[key] !== null && object[key] !== undefined;
}

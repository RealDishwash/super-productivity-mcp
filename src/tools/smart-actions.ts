import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import type { SuperProductivityTask } from "../types/super-productivity.js";
import { getTaskDeadlineTimestamp } from "./task-mapper.js";
import { handleJsonTool } from "./tool-response.js";

const DEFAULT_TASK_ESTIMATE_MS = 3_600_000;

export function setupSmartActions(server: McpServer, client: SuperProductivityClient): void {
  server.tool(
    "analyze_productivity",
    {
      days: z.number().default(7).describe("Number of days to analyze"),
    },
    async ({ days }) =>
      handleJsonTool(async () => {
        const tasks = await client.getTasks();
        const now = Date.now();
        const startDate = now - days * 24 * 60 * 60 * 1000;

        const recentTasks = tasks.filter(
          (task) => task.created >= startDate || (task.doneOn ?? 0) >= startDate,
        );
        const completedTasks = recentTasks.filter((task) => task.isDone);
        const totalEstimated = recentTasks.reduce(
          (sum, task) => sum + (task.timeEstimate ?? 0),
          0,
        );
        const totalSpent = recentTasks.reduce((sum, task) => sum + task.timeSpent, 0);

        return {
          period: `${days} days`,
          totalTasks: recentTasks.length,
          completedTasks: completedTasks.length,
          completionRate:
            recentTasks.length > 0
              ? `${((completedTasks.length / recentTasks.length) * 100).toFixed(1)}%`
              : "0%",
          totalTimeEstimated: `${(totalEstimated / (1000 * 60 * 60)).toFixed(1)} hours`,
          totalTimeSpent: `${(totalSpent / (1000 * 60 * 60)).toFixed(1)} hours`,
          estimationAccuracy:
            totalEstimated > 0
              ? `${((totalSpent / totalEstimated) * 100).toFixed(1)}%`
              : "N/A",
          insights: generateInsights(recentTasks, completedTasks, totalEstimated, totalSpent),
        };
      }),
  );

  server.tool(
    "suggest_priorities",
    {
      projectId: z.string().optional(),
      maxTasks: z.number().default(5),
    },
    async ({ projectId, maxTasks }) =>
      handleJsonTool(async () => {
        let tasks = await client.getCurrentContextTasks();
        if (projectId) {
          tasks = tasks.filter((task) => task.projectId === projectId);
        }

        const topTasks = tasks
          .filter((task) => !task.isDone)
          .map((task) => ({ task, score: scoreTaskPriority(task) }))
          .sort((left, right) => right.score - left.score)
          .slice(0, maxTasks)
          .map(({ task, score }) => ({
            id: task.id,
            title: task.title,
            priorityScore: score,
            reasons: explainPriority(task),
          }));

        return {
          suggestions: topTasks,
          message: `Top ${topTasks.length} priority tasks identified`,
        };
      }),
  );

  server.tool(
    "create_daily_plan",
    {
      availableHours: z.number().default(8).describe("Hours available to work"),
      includeBreaks: z.boolean().default(true),
    },
    async ({ availableHours, includeBreaks }) =>
      handleJsonTool(async () => {
        const tasks = await client.getCurrentContextTasks();
        const pendingTasks = tasks.filter((task) => !task.isDone);
        const availableMinutes = availableHours * 60;
        const breakMinutes = includeBreaks ? Math.floor(availableMinutes * 0.15) : 0;
        const workMinutes = availableMinutes - breakMinutes;

        const plannedTasks: Array<{
          id: string;
          title: string;
          estimatedMinutes: number;
          order: number;
        }> = [];
        let totalPlannedMinutes = 0;

        for (const task of pendingTasks) {
          const estimatedMinutes = Math.round(
            (task.timeEstimate ?? DEFAULT_TASK_ESTIMATE_MS) / (1000 * 60),
          );

          if (totalPlannedMinutes + estimatedMinutes > workMinutes) {
            continue;
          }

          plannedTasks.push({
            id: task.id,
            title: task.title,
            estimatedMinutes,
            order: plannedTasks.length + 1,
          });
          totalPlannedMinutes += estimatedMinutes;
        }

        return {
          date: new Date().toISOString().split("T")[0],
          totalAvailableTime: `${availableHours} hours`,
          workTime: `${Math.round(workMinutes / 60)} hours`,
          breakTime: includeBreaks ? `${Math.round(breakMinutes / 60)} hours` : "None",
          plannedTasks,
          totalPlannedTime: `${Math.floor(totalPlannedMinutes / 60)} hours ${totalPlannedMinutes % 60} minutes`,
          utilizationRate: `${((totalPlannedMinutes / workMinutes) * 100).toFixed(1)}%`,
        };
      }),
  );
}

function generateInsights(
  recentTasks: SuperProductivityTask[],
  completedTasks: SuperProductivityTask[],
  totalEstimated: number,
  totalSpent: number,
): string[] {
  const insights: string[] = [];
  const completionRate = recentTasks.length > 0 ? completedTasks.length / recentTasks.length : 0;

  if (completionRate > 0.8) {
    insights.push("Excellent completion rate. You are maintaining a strong pace.");
  } else if (completionRate < 0.4) {
    insights.push("Completion rate is low. Consider reducing task load or tightening estimates.");
  }

  if (totalEstimated > 0) {
    const accuracy = totalSpent / totalEstimated;
    if (accuracy > 1.2) {
      insights.push("You are underestimating work. Add more buffer to future estimates.");
    } else if (accuracy < 0.8) {
      insights.push("You are overestimating work. Tasks are finishing faster than expected.");
    }
  }

  const tasksWithoutEstimate = recentTasks.filter((task) => !task.timeEstimate).length;
  if (tasksWithoutEstimate > recentTasks.length * 0.3) {
    insights.push(
      `${tasksWithoutEstimate} tasks are still missing estimates. Adding them will improve planning.`,
    );
  }

  return insights;
}

function scoreTaskPriority(task: SuperProductivityTask): number {
  let score = 0;
  const deadlineTimestamp = getTaskDeadlineTimestamp(task);

  if (deadlineTimestamp !== null) {
    const daysUntilDue = (deadlineTimestamp - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue < 1) {
      score += 50;
    } else if (daysUntilDue < 3) {
      score += 30;
    } else if (daysUntilDue < 7) {
      score += 10;
    }
  }

  if (!task.timeEstimate) {
    score += 15;
  }

  if ((task.subTaskIds?.length ?? 0) > 0) {
    score += 20;
  }

  const ageInDays = (Date.now() - task.created) / (1000 * 60 * 60 * 24);
  if (ageInDays > 7) {
    score += 10;
  }
  if (ageInDays > 14) {
    score += 15;
  }

  return score;
}

function explainPriority(task: SuperProductivityTask): string[] {
  const reasons: string[] = [];
  const deadlineTimestamp = getTaskDeadlineTimestamp(task);

  if (deadlineTimestamp !== null) {
    const daysUntilDue = (deadlineTimestamp - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue < 1) {
      reasons.push("Deadline urgent (< 24h)");
    } else if (daysUntilDue < 3) {
      reasons.push("Deadline soon (< 3 days)");
    }
  }

  if (!task.timeEstimate) {
    reasons.push("Missing time estimate");
  }

  const subtaskCount = task.subTaskIds?.length ?? 0;
  if (subtaskCount > 0) {
    reasons.push(`Has ${subtaskCount} subtasks`);
  }

  const ageInDays = (Date.now() - task.created) / (1000 * 60 * 60 * 24);
  if (ageInDays > 14) {
    reasons.push("Old task (> 2 weeks)");
  }

  return reasons;
}

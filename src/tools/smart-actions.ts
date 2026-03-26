import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SuperProductivityClient } from "../client/sp-client.js";

export function setupSmartActions(
  server: McpServer,
  client: SuperProductivityClient,
) {
  // Tool: Análise inteligente de produtividade
  server.tool(
    "analyze_productivity",
    {
      days: z.number().default(7).describe("Number of days to analyze"),
    },
    async ({ days }) => {
      try {
        const tasks = await client.getTasks();
        const now = Date.now();
        const startDate = now - days * 24 * 60 * 60 * 1000;

        const recentTasks = tasks.filter(
          (t) => t.created >= startDate || (t.doneOn && t.doneOn >= startDate),
        );

        const completedTasks = recentTasks.filter((t) => t.isDone);
        const totalEstimated = recentTasks.reduce(
          (sum, t) => sum + (t.timeEstimate || 0),
          0,
        );
        const totalSpent = recentTasks.reduce((sum, t) => sum + t.timeSpent, 0);

        const analysis = {
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
          insights: generateInsights(
            recentTasks,
            completedTasks,
            totalEstimated,
            totalSpent,
          ),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Sugerir priorização
  server.tool(
    "suggest_priorities",
    {
      projectId: z.string().optional(),
      maxTasks: z.number().default(5),
    },
    async ({ projectId, maxTasks }) => {
      try {
        let tasks = await client.getCurrentContextTasks();
        if (projectId) {
          tasks = tasks.filter((t) => t.projectId === projectId);
        }

        // Filtrar apenas tarefas não concluídas
        const pendingTasks = tasks.filter((t) => !t.isDone);

        // Algoritmo de priorização simples
        const scoredTasks = pendingTasks.map((task) => {
          let score = 0;

          const deadlineTs = getDeadlineTimestamp(task);
          if (deadlineTs !== null) {
            const daysUntilDue =
              (deadlineTs - Date.now()) / (1000 * 60 * 60 * 24);
            if (daysUntilDue < 1) score += 50;
            else if (daysUntilDue < 3) score += 30;
            else if (daysUntilDue < 7) score += 10;
          }

          // Tarefas sem estimativa de tempo (precisam ser avaliadas)
          if (!task.timeEstimate) score += 15;

          // Tarefas com subtarefas incompletas
          if (task.subTaskIds && task.subTaskIds.length > 0) score += 20;

          // Tarefas mais antigas
          const ageInDays = (Date.now() - task.created) / (1000 * 60 * 60 * 24);
          if (ageInDays > 7) score += 10;
          if (ageInDays > 14) score += 15;

          return { task, score };
        });

        // Ordenar por score e pegar top N
        const topTasks = scoredTasks
          .sort((a, b) => b.score - a.score)
          .slice(0, maxTasks)
          .map(({ task, score }) => ({
            id: task.id,
            title: task.title,
            priorityScore: score,
            reasons: explainPriority(task, score),
          }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  suggestions: topTasks,
                  message: `Top ${topTasks.length} priority tasks identified`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Criar plano de trabalho diário
  server.tool(
    "create_daily_plan",
    {
      availableHours: z.number().default(8).describe("Hours available to work"),
      includeBreaks: z.boolean().default(true),
    },
    async ({ availableHours, includeBreaks }) => {
      try {
        const tasks = await client.getCurrentContextTasks();
        const pendingTasks = tasks.filter((t) => !t.isDone);

        const availableMinutes = availableHours * 60;
        const breakMinutes = includeBreaks
          ? Math.floor(availableMinutes * 0.15)
          : 0;
        const workMinutes = availableMinutes - breakMinutes;

        // Selecionar tarefas que cabem no tempo disponível
        const selectedTasks = [];
        let totalTime = 0;

        for (const task of pendingTasks) {
          const estimatedMinutes = (task.timeEstimate || 3600000) / (1000 * 60);
          if (totalTime + estimatedMinutes <= workMinutes) {
            selectedTasks.push({
              id: task.id,
              title: task.title,
              estimatedMinutes: Math.round(estimatedMinutes),
              order: selectedTasks.length + 1,
            });
            totalTime += estimatedMinutes;
          }
        }

        const plan = {
          date: new Date().toISOString().split("T")[0],
          totalAvailableTime: `${availableHours} hours`,
          workTime: `${Math.round(workMinutes / 60)} hours`,
          breakTime: includeBreaks
            ? `${Math.round(breakMinutes / 60)} hours`
            : "None",
          plannedTasks: selectedTasks,
          totalPlannedTime: `${Math.round(totalTime / 60)} hours ${Math.round(totalTime % 60)} minutes`,
          utilizationRate: `${((totalTime / workMinutes) * 100).toFixed(1)}%`,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(plan, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

function generateInsights(
  recentTasks: any[],
  completedTasks: any[],
  totalEstimated: number,
  totalSpent: number,
): string[] {
  const insights = [];
  const completionRate = recentTasks.length
    ? completedTasks.length / recentTasks.length
    : 0;

  if (completionRate > 0.8) {
    insights.push(
      "Excelente taxa de conclusão! Você está mantendo um ótimo ritmo.",
    );
  } else if (completionRate < 0.4) {
    insights.push(
      "Taxa de conclusão baixa. Considere revisar suas estimativas ou reduzir o número de tarefas.",
    );
  }

  if (totalEstimated > 0) {
    const accuracy = totalSpent / totalEstimated;
    if (accuracy > 1.2) {
      insights.push(
        "Você está subestimando o tempo necessário. Considere adicionar buffers às estimativas.",
      );
    } else if (accuracy < 0.8) {
      insights.push(
        "Você está superestimando o tempo. Suas tarefas estão sendo concluídas mais rápido que o esperado.",
      );
    }
  }

  const tasksWithoutEstimate = recentTasks.filter(
    (t) => !t.timeEstimate,
  ).length;
  if (tasksWithoutEstimate > recentTasks.length * 0.3) {
    insights.push(
      `${tasksWithoutEstimate} tarefas sem estimativa de tempo. Adicionar estimativas ajuda no planejamento.`,
    );
  }

  return insights;
}

function explainPriority(task: any, score: number): string[] {
  const reasons = [];

  const deadlineTs = getDeadlineTimestamp(task);
  if (deadlineTs !== null) {
    const daysUntilDue = (deadlineTs - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue < 1) reasons.push("Deadline urgente (< 24h)");
    else if (daysUntilDue < 3) reasons.push("Deadline próximo (< 3 dias)");
  }

  if (!task.timeEstimate) reasons.push("Sem estimativa de tempo");

  if (task.subTaskIds && task.subTaskIds.length > 0) {
    reasons.push(`Possui ${task.subTaskIds.length} subtarefas`);
  }

  const ageInDays = (Date.now() - task.created) / (1000 * 60 * 60 * 24);
  if (ageInDays > 14) reasons.push("Tarefa antiga (> 2 semanas)");

  return reasons;
}

function getDeadlineTimestamp(task: any): number | null {
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

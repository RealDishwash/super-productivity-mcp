import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import { handleJsonTool } from "./tool-response.js";

export function setupProjectTools(server: McpServer, client: SuperProductivityClient): void {
  server.tool(
    "list_projects",
    {},
    async () =>
      handleJsonTool(async () => {
        const projects = await client.getProjects();
        return {
          count: projects.length,
          projects,
        };
      }),
  );

  server.tool(
    "create_project",
    {
      title: z.string().describe("Project title"),
      theme: z.record(z.unknown()).optional().describe("Project theme configuration"),
      isArchived: z.boolean().optional().default(false),
    },
    async (params) =>
      handleJsonTool(async () => {
        const projectId = await client.createProject(params);
        return {
          success: true,
          projectId,
          message: `Project created: ${params.title}`,
        };
      }),
  );
}

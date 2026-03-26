import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import { handleJsonTool } from "./tool-response.js";

export function setupTagTools(server: McpServer, client: SuperProductivityClient): void {
  server.tool(
    "list_tags",
    {},
    async () =>
      handleJsonTool(async () => {
        const tags = await client.getTags();
        return {
          count: tags.length,
          tags,
        };
      }),
  );

  server.tool(
    "create_tag",
    {
      title: z.string().describe("Tag title"),
      color: z.string().optional().describe("Tag color (hex)"),
      icon: z.string().optional().describe("Tag icon name"),
    },
    async (params) =>
      handleJsonTool(async () => {
        const tagId = await client.createTag(params);
        return {
          success: true,
          tagId,
          message: `Tag created: ${params.title}`,
        };
      }),
  );

  server.tool(
    "update_tag",
    {
      tagId: z.string().describe("Tag ID to update"),
      title: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    },
    async ({ tagId, ...updates }) =>
      handleJsonTool(async () => {
        await client.updateTag(tagId, updates);
        return {
          success: true,
          message: "Tag updated successfully",
        };
      }),
  );
}

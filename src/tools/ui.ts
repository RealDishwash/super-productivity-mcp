import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import { handleJsonTool, handleTextTool } from "./tool-response.js";

export function setupUITools(server: McpServer, client: SuperProductivityClient): void {
  server.tool(
    "show_notification",
    {
      message: z.string().describe("Notification message"),
      type: z.enum(["SUCCESS", "ERROR", "INFO"]).optional().default("INFO"),
      duration: z.number().optional().describe("Duration in ms"),
    },
    async (params) =>
      handleTextTool(async () => {
        await client.notify(params);
        return "Notification sent";
      }),
  );

  server.tool(
    "show_snack",
    {
      message: z.string().describe("Snack message"),
      type: z.enum(["SUCCESS", "ERROR", "INFO"]).optional().default("INFO"),
      config: z.record(z.unknown()).optional(),
    },
    async (params) =>
      handleTextTool(async () => {
        await client.showSnack(params);
        return "Snack shown";
      }),
  );

  server.tool(
    "open_dialog",
    {
      type: z.enum(["CONFIRM", "PROMPT"]).optional().default("CONFIRM"),
      title: z.string().optional(),
      message: z.string().describe("Dialog message"),
      confirmText: z.string().optional(),
      cancelText: z.string().optional(),
    },
    async (params) =>
      handleJsonTool(async () => {
        return client.openDialog(params);
      }),
  );
}

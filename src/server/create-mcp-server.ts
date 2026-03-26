import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_NAME, APP_VERSION } from "../constants.js";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import { registerTools } from "./register-tools.js";

export function createMcpServer(client: SuperProductivityClient): McpServer {
  const server = new McpServer({
    name: APP_NAME,
    version: APP_VERSION,
  });

  registerTools(server, client);
  return server;
}

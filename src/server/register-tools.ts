import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperProductivityClient } from "../client/super-productivity-client.js";
import { setupProjectTools } from "../tools/projects.js";
import { setupSmartActions } from "../tools/smart-actions.js";
import { setupTagTools } from "../tools/tags.js";
import { setupTaskTools } from "../tools/tasks.js";
import { setupUITools } from "../tools/ui.js";

export function registerTools(server: McpServer, client: SuperProductivityClient): void {
  setupTaskTools(server, client);
  setupProjectTools(server, client);
  setupSmartActions(server, client);
  setupUITools(server, client);
  setupTagTools(server, client);
}

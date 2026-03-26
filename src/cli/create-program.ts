import { Command } from "commander";
import { APP_VERSION, getServerPort } from "../constants.js";
import { SocketSuperProductivityClient } from "../client/socket-client.js";
import { startServer } from "../server/start-server.js";

export function createProgram(): Command {
  const program = new Command();

  program.version(APP_VERSION).description("Super Productivity MCP CLI");

  program
    .command("start")
    .description("Start the Super Productivity MCP server")
    .action(async () => {
      const client = new SocketSuperProductivityClient();
      const port = getServerPort();
      await startServer(port, client);
    });

  return program;
}

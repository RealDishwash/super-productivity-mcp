#!/usr/bin/env node

import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { io as socketIOClient } from "socket.io-client";
import { randomUUID } from "crypto";
import { setupTaskTools } from "./tools/tasks.js";
import { setupProjectTools } from "./tools/projects.js";
import { setupSmartActions } from "./tools/smart-actions.js";
import { setupUITools } from "./tools/ui.js";
import { setupTagTools } from "./tools/tags.js";

class SocketSuperProductivityClient {
    private socket: Socket | null = null;
  
    setSocket(socket: Socket) {
      this.socket = socket;
    }
  
    private async emitWithAck<T>(event: string, data?: any): Promise<T> {
      if (!this.socket) {
        throw new Error(
          "Plugin Super Productivity não está conectado. Verifique se o plugin está instalado e ativo.",
        );
      }
  
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout aguardando resposta do plugin para evento ${event}`,
            ),
          );
        }, 10000);
  
        this.socket!.emit(event, data, (response: any) => {
          clearTimeout(timeout);
          if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
    }
  
    async getTasks(): Promise<any[]> {
      return this.emitWithAck("tasks:get");
    }
  
    async getCurrentContextTasks(): Promise<any[]> {
      return this.emitWithAck("tasks:getCurrent");
    }
  
    async createTask(taskData: any): Promise<string> {
      return this.emitWithAck("tasks:create", taskData);
    }
  
    async updateTask(taskId: string, updates: any): Promise<void> {
      return this.emitWithAck("tasks:update", { taskId, updates });
    }
  
    async deleteTask(taskId: string): Promise<void> {
      return this.emitWithAck("tasks:delete", { taskId });
    }
  
    async batchUpdate(projectId: string, operations: any[]): Promise<any> {
      return this.emitWithAck("tasks:batch", { projectId, operations });
    }
  
    async getProjects(): Promise<any[]> {
      return this.emitWithAck("projects:get");
    }
  
    async createProject(projectData: any): Promise<string> {
      return this.emitWithAck("projects:create", projectData);
    }
  
    async getTags(): Promise<any[]> {
      return this.emitWithAck("tags:get");
    }
  
    async createTag(tagData: any): Promise<string> {
      return this.emitWithAck("tags:create", tagData);
    }
  
    async updateTag(tagId: string, updates: any): Promise<void> {
      return this.emitWithAck("tags:update", { tagId, updates });
    }
  
    async notify(config: any): Promise<void> {
      return this.emitWithAck("ui:notify", config);
    }
  
    async showSnack(config: any): Promise<void> {
      return this.emitWithAck("ui:showSnack", config);
    }
  
    async openDialog(config: any): Promise<any> {
      return this.emitWithAck("ui:openDialog", config);
    }
  }

const program = new Command();
const spClient = new SocketSuperProductivityClient() as any;

program
  .version('1.0.0')
  .description('Super Productivity MCP CLI');

program
  .command('start')
  .description('Start the Super Productivity MCP Server')
  .action(() => {
    const port = process.env.PORT || 3000;
    const app = express();
    const httpServer = createServer(app);
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    app.use(express.json());

    io.on("connection", (socket) => {
      console.log("Plugin Super Productivity conectado:", socket.id);
      spClient.setSocket(socket);

      socket.on("disconnect", () => {
        console.log("Plugin Super Productivity desconectado:", socket.id);
        if (spClient.socket?.id === socket.id) {
          spClient.setSocket(null);
        }
      });
    });

    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    app.post("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
            console.log(`MCP Session initialized: ${sid}`);
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            console.log(`MCP Session closed: ${transport.sessionId}`);
            delete transports[transport.sessionId];
          }
        };

        const server = new McpServer({
          name: "super-productivity",
          version: "1.0.0",
        });

        setupTaskTools(server, spClient);
        setupProjectTools(server, spClient);
        setupSmartActions(server, spClient);
        setupUITools(server, spClient);
        setupTagTools(server, spClient);

        await server.connect(transport);
      } else {
        return res.status(400).json({
          error: { message: "Bad Request: No valid session ID" },
        });
      }

      await transport.handleRequest(req, res, req.body);
    });

    const handleSessionRequest = async (
      req: express.Request,
      res: express.Response,
    ) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        return res.status(404).send("Session not found");
      }
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    };

    app.get("/mcp", handleSessionRequest);
    app.delete("/mcp", handleSessionRequest);

    httpServer.listen(port, () => {
      figlet.text('SUPER PRODUCTIVITY MCP', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
        width: 80,
        whitespaceBreak: true
      }, function(err: Error | null, data?: string) {
        if (err) {
            console.log('Something went wrong...');
            console.dir(err);
            return;
        }
        console.log(chalk.blue(data ?? ''));
        console.log(chalk.green(`Super Productivity MCP Server running on http://localhost:${port}/mcp`));
      });
    });
  });

program
  .command('connect')
  .description('Connect to the Super Productivity plugin')
  .action(() => {
    const socket = socketIOClient("http://localhost:1044");
    spClient.setSocket(socket);
    console.log('Connecting to Super Productivity plugin...');
    socket.on('connect', () => {
      console.log(chalk.green('Connected to Super Productivity plugin.'));
    });
    socket.on('disconnect', () => {
      console.log(chalk.red('Disconnected from Super Productivity plugin.'));
    });
  });

program
  .command('projects')
  .description('List all projects')
  .action(async () => {
    try {
      const projects = await spClient.getProjects();
      console.log(chalk.blue('Projects:'));
      console.log(projects);
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

program
  .command('tasks')
  .description('List all tasks')
  .action(async () => {
    try {
      const tasks = await spClient.getTasks();
      console.log(chalk.blue('Tasks:'));
      console.log(tasks);
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

program
  .command('tags')
  .description('List all tags')
  .action(async () => {
    try {
      const tags = await spClient.getTags();
      console.log(chalk.blue('Tags:'));
      console.log(tags);
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

program.parse(process.argv);

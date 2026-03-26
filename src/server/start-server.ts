import { randomUUID } from "crypto";
import { createServer } from "http";
import express from "express";
import figlet from "figlet";
import chalk from "chalk";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { APP_NAME } from "../constants.js";
import type { SocketSuperProductivityClient } from "../client/socket-client.js";
import { createMcpServer } from "./create-mcp-server.js";

type SessionTransportMap = Map<string, StreamableHTTPServerTransport>;

export async function startServer(
  port: number,
  client: SocketSuperProductivityClient,
): Promise<void> {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  const transports: SessionTransportMap = new Map();

  app.use(express.json());
  setupSocketBridge(io, client);

  app.post("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId) {
        const transport = createTransport(transports);
        const server = createMcpServer(client);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(400).json({
          error: { message: "Bad Request: No valid session ID" },
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  const handleSessionRequest = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing session ID");
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }

    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : String(error));
    }
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      renderStartupBanner(port);
      resolve();
    });
  });
}

function setupSocketBridge(io: SocketIOServer, client: SocketSuperProductivityClient): void {
  io.on("connection", (socket: Socket) => {
    const previousSocketId = client.getSocketId();
    client.setSocket(socket);

    if (previousSocketId && previousSocketId !== socket.id) {
      console.log(`Super Productivity plugin connection replaced: ${previousSocketId} -> ${socket.id}`);
    } else {
      console.log(`Super Productivity plugin connected: ${socket.id}`);
    }

    socket.on("disconnect", () => {
      console.log(`Super Productivity plugin disconnected: ${socket.id}`);

      if (client.getSocketId() === socket.id) {
        client.setSocket(null);
      }
    });
  });
}

function createTransport(transports: SessionTransportMap): StreamableHTTPServerTransport {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      transports.set(sessionId, transport);
      console.log(`MCP session initialized: ${sessionId}`);
    },
  });

  transport.onclose = () => {
    if (!transport.sessionId) {
      return;
    }

    console.log(`MCP session closed: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  };

  return transport;
}

function renderStartupBanner(port: number): void {
  figlet.text(
    APP_NAME.toUpperCase().replace(/-/g, " "),
    {
      font: "Standard",
      horizontalLayout: "default",
      verticalLayout: "default",
      width: 80,
      whitespaceBreak: true,
    },
    (error: Error | null, data?: string) => {
      if (error) {
        console.log("Failed to render banner.");
        console.dir(error);
        return;
      }

      console.log(chalk.blue(data ?? ""));
      console.log(chalk.green(`${APP_NAME} MCP Server running on http://localhost:${port}/mcp`));
    },
  );
}

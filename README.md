# Super Productivity MCP

[![Docker Image](https://img.shields.io/badge/ghcr.io-super--productivity--mcp-blue?logo=docker)](https://ghcr.io/realdishwash/super-productivity-mcp)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

An MCP (Model Context Protocol) server that integrates Super Productivity with AI assistants through a Socket.IO bridge plugin.

## About

This project enables AI assistants to manage tasks, projects, tags, and lightweight UI workflows directly inside Super Productivity.

## Requirements

- Docker (recommended)
- Bun 1.3+
- Super Productivity v14.0.0+

## Quick Start

### 1. Run the MCP Server

Recommended with Docker:

```bash
docker pull ghcr.io/realdishwash/super-productivity-mcp:latest
docker run --rm -p 3000:3000 --name super-productivity-mcp ghcr.io/realdishwash/super-productivity-mcp:latest
```

Or with Docker Compose:

```yaml
services:
  super-productivity-mcp:
    image: ghcr.io/realdishwash/super-productivity-mcp:latest
    container_name: super-productivity-mcp
    ports:
      - "3000:3000"
    restart: unless-stopped
```

Then run:

```bash
docker compose up -d
```

Or build the image locally:

```bash
cd super-productivity-mcp
docker build -t super-productivity-mcp .
docker run --rm -p 3000:3000 --name super-productivity-mcp super-productivity-mcp
```

Or run it directly with Bun:

```bash
cd super-productivity-mcp
bun install
bun run build
bun run start
```

### 2. Build and Install the Super Productivity Plugin

First generate the plugin bundle:

```bash
bun run build:plugin
```

1. Open Super Productivity > Settings > Plugins
2. Create a zip from the contents of `mcp-bridge-plugin/`
3. Install that zip file
4. Restart the app

The generated plugin bundle at `mcp-bridge-plugin/plugin.js` is built from `mcp-bridge-plugin/socket.io.min.js` and `mcp-bridge-plugin/plugin-logic.js` and is not tracked in git.

### 3. Configure OpenCode

Example configuration for `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "super-productivity": {
      "type": "remote",
      "url": "http://127.0.0.1:3000/mcp",
      "enabled": true,
      "timeout": 10000
    }
  }
}
```

### 4. Run on Startup with systemd Quadlet

On this machine, the MCP server is configured to start via a user-level systemd Quadlet backed by Podman.

OpenCode connects to the server with:

```json
{
  "mcp": {
    "super-productivity": {
      "type": "remote",
      "url": "http://127.0.0.1:3000/mcp",
      "enabled": true,
      "timeout": 10000
    }
  }
}
```

The user service definition lives at `~/.config/containers/systemd/super-productivity-mcp.container`:

```ini
[Unit]
Description=Super Productivity MCP Server
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/realdishwash/super-productivity-mcp:latest
ContainerName=super-productivity-mcp
PublishPort=3000:3000
Environment=PORT=3000
Pull=newer
AutoUpdate=registry

[Service]
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

systemd generates `super-productivity-mcp.service` from that file. Because the unit is installed with `WantedBy=default.target`, it starts automatically with the user's systemd session.

Notes:

- This is a user service, not a system-wide boot service.
- With `loginctl show-user "$USER" -p Linger` set to `Linger=no`, it starts when the user session starts, typically at login.
- To verify the current status, run `systemctl --user status super-productivity-mcp.service`.

## Configuration

Create a `.env` file and add:

```env
PORT=3000
```

## Available Tools

All tools are exposed through the MCP server and can be invoked by AI assistants.

### Tasks
| Tool | Description |
|------|-------------|
| `get_task` | Get a single task by ID |
| `list_tasks` | List tasks |
| `search_tasks` | Search tasks by text and common filters |
| `create_task` | Create a task, including scheduling and deadlines |
| `update_task` | Update a task, including scheduling and deadlines |
| `complete_task` | Mark a task as complete |
| `delete_task` | Delete a task |
| `batch_update_tasks` | Batch operations on tasks |

Task lookup guidance:

- Use `get_task` when you already know the exact task ID and want one task.
- Use `list_tasks` when you want a broad task listing, optionally scoped by project or current context.
- Use `search_tasks` when you need discovery across tasks by text, status, deadline, estimate, or tag filters.

Scheduling fields supported by `create_task` and `update_task`:

- `startAt`: scheduled start as ISO datetime or Unix ms
- `startDate`: scheduled all-day start as `YYYY-MM-DD`
- `remindAt`: reminder time as ISO datetime or Unix ms

Deadline fields supported by `create_task` and `update_task`:

- `deadlineAt`: deadline with time as ISO datetime or Unix ms
- `deadlineDate`: all-day deadline as `YYYY-MM-DD`
- `deadlineRemindAt`: deadline reminder time as ISO datetime or Unix ms

Example:

```json
{
  "title": "Pay SSAF fee",
  "startAt": "2026-03-26T09:00:00+11:00",
  "remindAt": "2026-03-26T08:45:00+11:00",
  "deadlineDate": "2026-04-02",
  "deadlineRemindAt": "2026-04-01T18:00:00+11:00"
}
```

Example `search_tasks` input:

```json
{
  "query": "invoice",
  "projectId": "project-123",
  "isDone": false,
  "overdue": true,
  "hasDeadline": true,
  "hasEstimate": false,
  "limit": 10
}
```

Example `get_task` input:

```json
{
  "taskId": "task-123"
}
```

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | List projects |
| `create_project` | Create a project |

### Tags
| Tool | Description |
|------|-------------|
| `list_tags` | List tags |
| `create_tag` | Create a tag |
| `update_tag` | Update a tag |

### Smart Actions
| Tool | Description |
|------|-------------|
| `analyze_productivity` | Productivity analysis |
| `suggest_priorities` | Suggest priorities |
| `create_daily_plan` | Create a daily work plan |

### UI
| Tool | Description |
|------|-------------|
| `show_notification` | Show a notification in Super Productivity |
| `show_snack` | Show an in-app snack message |
| `open_dialog` | Open a confirm or prompt dialog |

## Project Structure

```
super-productivity-mcp/
├── src/
│   ├── index.ts                # Entry point
│   ├── cli/
│   │   └── create-program.ts   # CLI wiring
│   ├── client/
│   │   ├── socket-client.ts    # Live Socket.IO bridge client
│   │   └── super-productivity-client.ts
│   ├── server/
│   │   ├── create-mcp-server.ts
│   │   ├── register-tools.ts
│   │   └── start-server.ts
│   ├── types/
│   │   └── super-productivity.ts
│   └── tools/
│       ├── task-mapper.ts
│       ├── tool-response.ts
│       ├── tasks.ts
│       ├── projects.ts
│       ├── tags.ts
│       ├── ui.ts
│       └── smart-actions.ts
├── mcp-bridge-plugin/
│   ├── manifest.json      # Plugin manifest
│   ├── plugin-logic.js    # Plugin bridge source
│   └── socket.io.min.js   # Socket.IO library
└── package.json
```

## Development

```bash
bun run dev
```

`bun run build` also regenerates the local `mcp-bridge-plugin/plugin.js` bundle.

## Contact

Connect with the author on LinkedIn: [Delon Rocha](https://www.linkedin.com/in/delonrocha/)

## Verify the Installation

1. Start the server with Docker or `bun run start`
2. Open Super Productivity
3. In the browser console (F12), verify a successful MCP Bridge connection message
4. In the server terminal, verify the plugin connection message appears

## License

ISC

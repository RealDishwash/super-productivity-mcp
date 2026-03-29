# Super Productivity MCP

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
| `list_tasks` | List tasks |
| `create_task` | Create a task, including scheduling and deadlines |
| `update_task` | Update a task, including scheduling and deadlines |
| `complete_task` | Mark a task as complete |
| `batch_update_tasks` | Batch operations on tasks |

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

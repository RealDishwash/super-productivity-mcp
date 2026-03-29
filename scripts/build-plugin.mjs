import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pluginDir = path.join(repoRoot, "mcp-bridge-plugin");

const socketIoPath = path.join(pluginDir, "socket.io.min.js");
const pluginLogicPath = path.join(pluginDir, "plugin-logic.js");
const outputPath = path.join(pluginDir, "plugin.js");

const [socketIoSource, pluginLogicSource] = await Promise.all([
  readFile(socketIoPath, "utf8"),
  readFile(pluginLogicPath, "utf8"),
]);

const banner = [
  "/*",
  " * Generated file. Do not edit directly.",
  " * Source files:",
  " * - mcp-bridge-plugin/socket.io.min.js",
  " * - mcp-bridge-plugin/plugin-logic.js",
  " */",
  "",
].join("\n");

await writeFile(outputPath, `${banner}${socketIoSource.trimEnd()}\n\n${pluginLogicSource.trimEnd()}\n`);

console.log(`Built plugin bundle: ${path.relative(repoRoot, outputPath)}`);

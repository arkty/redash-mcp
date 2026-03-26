#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { RedashClient } from "./client/redash-client.js";
import { registerDataSourceTools } from "./tools/data-sources.js";
import { registerExecuteTools } from "./tools/execute.js";

async function main() {
  const config = loadConfig();
  const client = new RedashClient(config);

  const server = new McpServer({
    name: "redash-mcp-server",
    version: "0.1.0",
  });

  registerDataSourceTools(server, client);
  registerExecuteTools(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("Redash MCP Server started\n");
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error.message}\n`);
  process.exit(1);
});

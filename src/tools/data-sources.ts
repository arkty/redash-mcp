import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RedashClient } from "../client/redash-client.js";
import type { RedashSchemaTable } from "../client/types.js";

// In-memory schema cache
const schemaCache = new Map<number, { tables: RedashSchemaTable[]; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSchemaWithCache(
  client: RedashClient,
  dataSourceId: number,
): Promise<RedashSchemaTable[]> {
  const cached = schemaCache.get(dataSourceId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.tables;
  }

  const result = await client.getDataSourceSchema(dataSourceId);
  const tables = result.schema ?? [];
  schemaCache.set(dataSourceId, { tables, cachedAt: Date.now() });
  return tables;
}

function normalizeColumns(table: RedashSchemaTable): Array<{ name: string; type: string }> {
  return table.columns.map((col) => {
    if (typeof col === "string") {
      return { name: col, type: "unknown" };
    }
    return { name: col.name, type: col.type ?? "unknown" };
  });
}

export function registerDataSourceTools(
  server: McpServer,
  client: RedashClient,
): void {
  server.registerTool(
    "list_data_sources",
    {
      description: "List all available Redash data sources (databases) with their IDs, names, and types",
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const sources = await client.listDataSources();
        const lines = sources.map(
          (s) =>
            `[${s.id}] ${s.name} (${s.type})${s.view_only ? " [VIEW ONLY]" : ""}${s.paused ? " [PAUSED]" : ""}`,
        );
        return {
          content: [{ type: "text", text: lines.join("\n") || "No data sources found." }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to list data sources: ${(error as Error).message}` }],
        };
      }
    },
  );

  server.registerTool(
    "get_data_source_schema",
    {
      description: "Get the full database schema (all tables and their columns) for a data source. Use list_data_sources first to find the data_source_id.",
      inputSchema: { data_source_id: z.number().describe("Data source ID (from list_data_sources)") },
      annotations: { readOnlyHint: true },
    },
    async ({ data_source_id }) => {
      try {
        const tables = await getSchemaWithCache(client, data_source_id);

        if (tables.length === 0) {
          return {
            content: [{ type: "text", text: "No tables found in this data source." }],
          };
        }

        const lines: string[] = [];
        for (const table of tables) {
          const cols = normalizeColumns(table);
          lines.push(`Table: ${table.name} (${cols.length} columns)`);
          for (const col of cols) {
            lines.push(`  - ${col.name} (${col.type})`);
          }
          lines.push("");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get schema: ${(error as Error).message}` }],
        };
      }
    },
  );

  server.registerTool(
    "get_table_info",
    {
      description: "Get detailed column information (names and types) for a specific table. Use search_schema if you don't know the exact table name.",
      inputSchema: {
        data_source_id: z.number().describe("Data source ID"),
        table_name: z.string().describe("Exact table name"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ data_source_id, table_name }) => {
      try {
        const tables = await getSchemaWithCache(client, data_source_id);
        const table = tables.find(
          (t) => t.name.toLowerCase() === table_name.toLowerCase(),
        );

        if (!table) {
          return {
            isError: true,
            content: [{ type: "text", text: `Table "${table_name}" not found. Use search_schema to find available tables.` }],
          };
        }

        const cols = normalizeColumns(table);
        const lines = [
          `Table: ${table.name}`,
          `Columns (${cols.length}):`,
          ...cols.map((c) => `  - ${c.name} (${c.type})`),
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get table info: ${(error as Error).message}` }],
        };
      }
    },
  );

  server.registerTool(
    "search_schema",
    {
      description: "Search for tables and columns by name pattern (case-insensitive). Useful when you don't know the exact table or column name.",
      inputSchema: {
        data_source_id: z.number().describe("Data source ID"),
        search: z.string().describe("Search pattern (matches table names and column names)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ data_source_id, search }) => {
      try {
        const tables = await getSchemaWithCache(client, data_source_id);
        const pattern = search.toLowerCase();

        const matches: string[] = [];

        for (const table of tables) {
          const cols = normalizeColumns(table);
          const tableNameMatch = table.name.toLowerCase().includes(pattern);
          const matchingCols = cols.filter((c) =>
            c.name.toLowerCase().includes(pattern),
          );

          if (tableNameMatch || matchingCols.length > 0) {
            matches.push(`Table: ${table.name}${tableNameMatch ? " <-- table name match" : ""}`);
            for (const col of cols) {
              const colMatch = col.name.toLowerCase().includes(pattern);
              matches.push(
                `  - ${col.name} (${col.type})${colMatch ? " <-- column match" : ""}`,
              );
            }
            matches.push("");
          }
        }

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `No tables or columns matching "${search}" found.` }],
          };
        }

        return {
          content: [{ type: "text", text: matches.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to search schema: ${(error as Error).message}` }],
        };
      }
    },
  );
}

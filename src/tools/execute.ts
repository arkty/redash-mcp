import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RedashClient } from "../client/redash-client.js";
import type { Config } from "../config.js";
import { validateReadOnlySQL } from "../utils/sql-guard.js";
import { pollQueryResult } from "../utils/polling.js";
import {
  formatJsonResult,
  formatJsonResultText,
  saveCsvResult,
  formatCsvSaveResultText,
} from "../utils/formatter.js";

export function registerExecuteTools(
  server: McpServer,
  client: RedashClient,
  config: Config,
): void {
  server.registerTool(
    "execute_adhoc_query",
    {
      description: `Execute a SQL query directly against a data source. No query object is created in Redash — leaves no trace. Destructive SQL (INSERT/UPDATE/DELETE/DROP etc.) is blocked. For running queries this is the DEFAULT tool. Use create_query only when user explicitly asks to save a query to Redash web UI.${config.defaultTable ? ` Default table: ${config.defaultTable} — use it when user doesn't specify a table.` : ""}`,
      inputSchema: {
        query: z.string().describe("SQL query to execute (SELECT only)"),
        data_source_id: z.number().optional().describe("Data source ID (from list_data_sources). Optional if REDASH_DEFAULT_DATA_SOURCE_ID is set."),
        format: z
          .enum(["json", "csv"])
          .default("json")
          .describe("Result format: 'json' returns data in response, 'csv' saves to file and returns file path"),
        output_path: z
          .string()
          .optional()
          .describe("Custom file path for CSV output. If omitted, saves to cwd as adhoc_{timestamp}.csv"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, data_source_id, format, output_path }) => {
      try {
        const dsId = data_source_id ?? config.defaultDataSourceId;
        if (dsId === undefined) {
          return {
            isError: true,
            content: [{ type: "text", text: "data_source_id is required. Either pass it or set REDASH_DEFAULT_DATA_SOURCE_ID." }],
          };
        }

        const guard = validateReadOnlySQL(query);
        if (!guard.allowed) {
          return {
            isError: true,
            content: [{ type: "text", text: guard.reason! }],
          };
        }

        const response = await client.executeAdhocQuery(query, dsId);

        let resultId: number;
        let immediateResult = response.query_result;

        if (immediateResult) {
          resultId = immediateResult.id;
        } else if (response.job) {
          resultId = await pollQueryResult(client, response.job.id, {
            pollInterval: config.pollInterval,
            maxAttempts: config.maxPollAttempts,
          });
        } else {
          throw new Error("Unexpected response: no job or query_result");
        }

        if (format === "csv") {
          const csvData = await client.getQueryResultCsv(resultId);
          const saveResult = await saveCsvResult(csvData, config.outputDir, "adhoc", output_path);
          return {
            content: [{ type: "text", text: formatCsvSaveResultText(saveResult) }],
          };
        }

        // JSON: reuse immediate result if available, otherwise fetch
        if (!immediateResult) {
          const fetched = await client.getQueryResult(resultId);
          immediateResult = fetched.query_result;
        }

        const formatted = formatJsonResult(immediateResult, config.maxRows);
        return {
          content: [{ type: "text", text: formatJsonResultText(formatted) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Query execution failed: ${(error as Error).message}` }],
        };
      }
    },
  );
}

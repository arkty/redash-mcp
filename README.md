# @arkty/redash-mcp

[![Made with AI](https://img.shields.io/badge/Made%20with-AI-blue)](https://claude.ai) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![npm](https://img.shields.io/npm/v/@arkty/redash-mcp)](https://www.npmjs.com/package/@arkty/redash-mcp)

MCP Server for [Redash](https://redash.io) — execute SQL queries, explore database schemas, and get results as JSON or CSV.

- **Ad-hoc queries** without creating objects in Redash (no trace left)
- **SQL write guard** — destructive operations (INSERT/UPDATE/DELETE/DROP) are blocked
- **CSV export** — saves results to file, returns summary to LLM
- **Schema exploration** — list tables, search columns, inspect structure
- **Default data source** — configure once, query without specifying every time

## Installation

```bash
npx -y @arkty/redash-mcp
```

## Configuration

### Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "redash": {
      "command": "npx",
      "args": ["-y", "@arkty/redash-mcp"],
      "env": {
        "REDASH_URL": "https://your-redash.example.com",
        "REDASH_API_KEY": "your-api-key",
        "REDASH_DEFAULT_DATA_SOURCE_ID": "1"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDASH_URL` | Yes | — | Redash instance URL |
| `REDASH_API_KEY` | Yes | — | User API key (from Redash profile settings) |
| `REDASH_DEFAULT_DATA_SOURCE_ID` | No | — | Default data source ID |
| `REDASH_DEFAULT_TABLE` | No | — | Default table name (shown in tool description) |
| `REDASH_TIMEOUT` | No | 30000 | Request timeout in ms |
| `REDASH_MAX_ROWS` | No | 500 | Max rows in JSON response |
| `REDASH_POLL_INTERVAL` | No | 1000 | Job polling interval in ms |
| `REDASH_MAX_POLL_ATTEMPTS` | No | 120 | Max poll attempts before timeout |
| `REDASH_OUTPUT_DIR` | No | `.` | Directory for CSV file output |
| `REDASH_EXTRA_HEADERS` | No | — | Extra HTTP headers (JSON or `key=value;key2=value2`) |

## Tools

### `execute_adhoc_query`

Execute SQL directly against a data source. No query object is created in Redash. Destructive SQL is blocked.

Parameters: `query`, `data_source_id?`, `format? ("json" | "csv")`

### `list_data_sources`

List all available data sources with IDs, names, and types.

### `get_data_source_schema`

Get full database schema (all tables and columns) for a data source.

Parameters: `data_source_id`

### `get_table_info`

Get column names and types for a specific table.

Parameters: `data_source_id`, `table_name`

### `search_schema`

Search tables and columns by name pattern (case-insensitive).

Parameters: `data_source_id`, `search`

## Security

- Destructive SQL (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, etc.) is blocked at the MCP server level. **The filter is intentionally simple** — it checks for keyword presence in the query text. This means it may produce false positives (e.g., `SELECT REPLACE(...)` is blocked because `REPLACE` is a keyword). This is a safety net, not a bulletproof solution.
- Use read-only database credentials in your Redash data source configuration — this is the real protection layer
- API key is passed via environment variable, never hardcoded

## License

MIT

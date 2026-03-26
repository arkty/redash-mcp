import { z } from "zod";

const configSchema = z.object({
  redashUrl: z
    .url("REDASH_URL must be a valid URL")
    .transform((url) => url.replace(/\/+$/, "")),
  apiKey: z.string().min(1, "REDASH_API_KEY is required"),
  timeout: z.coerce.number().positive().default(30000),
  maxRows: z.coerce.number().positive().default(500),
  pollInterval: z.coerce.number().positive().default(1000),
  maxPollAttempts: z.coerce.number().positive().default(120),
  outputDir: z.string().default("."),
  defaultDataSourceId: z.coerce.number().positive().optional(),
  defaultTable: z.string().optional(),
  extraHeaders: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return {};
      try {
        return JSON.parse(val) as Record<string, string>;
      } catch {
        // Support key=value;key2=value2 format
        const headers: Record<string, string> = {};
        for (const pair of val.split(";")) {
          const [key, ...rest] = pair.split("=");
          if (key && rest.length > 0) {
            headers[key.trim()] = rest.join("=").trim();
          }
        }
        return headers;
      }
    }),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    redashUrl: process.env.REDASH_URL,
    apiKey: process.env.REDASH_API_KEY,
    timeout: process.env.REDASH_TIMEOUT,
    maxRows: process.env.REDASH_MAX_ROWS,
    pollInterval: process.env.REDASH_POLL_INTERVAL,
    maxPollAttempts: process.env.REDASH_MAX_POLL_ATTEMPTS,
    outputDir: process.env.REDASH_OUTPUT_DIR,
    defaultDataSourceId: process.env.REDASH_DEFAULT_DATA_SOURCE_ID,
    defaultTable: process.env.REDASH_DEFAULT_TABLE,
    extraHeaders: process.env.REDASH_EXTRA_HEADERS,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration error:\n${errors}`);
  }

  return result.data;
}

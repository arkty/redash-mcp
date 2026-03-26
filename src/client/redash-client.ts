import type { Config } from "../config.js";
import type {
  RedashDataSource,
  RedashSchema,
  RedashQueryResult,
  RedashJob,
  RedashExecuteResponse,
} from "./types.js";

interface RequestOptions {
  method?: string;
  body?: unknown;
  responseType?: "json" | "text";
}

export class RedashClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private extraHeaders: Record<string, string>;

  constructor(config: Config) {
    this.baseUrl = config.redashUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout;
    this.extraHeaders = config.extraHeaders;
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = "GET", body, responseType = "json" } = options;

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Key ${this.apiKey}`,
      ...this.extraHeaders,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Redash API error: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
        );
      }

      if (responseType === "text") {
        return (await response.text()) as T;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms: ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Data Sources

  async listDataSources(): Promise<RedashDataSource[]> {
    return this.request<RedashDataSource[]>("/api/data_sources");
  }

  async getDataSourceSchema(dataSourceId: number): Promise<RedashSchema> {
    return this.request<RedashSchema>(
      `/api/data_sources/${dataSourceId}/schema`,
    );
  }

  // Query Execution

  async executeAdhocQuery(
    query: string,
    dataSourceId: number,
  ): Promise<RedashExecuteResponse> {
    return this.request<RedashExecuteResponse>("/api/query_results", {
      method: "POST",
      body: {
        query,
        data_source_id: dataSourceId,
        max_age: 0,
      },
    });
  }

  // Jobs

  async getJob(jobId: string): Promise<{ job: RedashJob }> {
    return this.request<{ job: RedashJob }>(`/api/jobs/${jobId}`);
  }

  // Results

  async getQueryResult(resultId: number): Promise<{
    query_result: RedashQueryResult;
  }> {
    return this.request<{ query_result: RedashQueryResult }>(
      `/api/query_results/${resultId}`,
    );
  }

  async getQueryResultCsv(resultId: number): Promise<string> {
    return this.request<string>(`/api/query_results/${resultId}.csv`, {
      responseType: "text",
    });
  }
}

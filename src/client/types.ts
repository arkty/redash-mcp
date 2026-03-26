export interface RedashDataSource {
  id: number;
  name: string;
  type: string;
  view_only: boolean;
  syntax: string;
  paused: number;
  pause_reason: string | null;
}

export interface RedashSchemaColumn {
  name: string;
  type?: string;
}

export interface RedashSchemaTable {
  name: string;
  columns: string[] | RedashSchemaColumn[];
}

export interface RedashSchema {
  schema: RedashSchemaTable[];
}

export interface RedashColumn {
  name: string;
  type: string;
  friendly_name: string;
}

export interface RedashQueryResultData {
  columns: RedashColumn[];
  rows: Record<string, unknown>[];
}

export interface RedashQueryResult {
  id: number;
  query_hash: string;
  query: string;
  data: RedashQueryResultData;
  data_source_id: number;
  runtime: number;
  retrieved_at: string;
}

export enum JobStatus {
  PENDING = 1,
  STARTED = 2,
  SUCCESS = 3,
  FAILURE = 4,
  CANCELLED = 5,
}

export interface RedashJob {
  id: string;
  status: JobStatus;
  error: string;
  query_result_id: number | null;
  updated_at: number;
}

export interface RedashExecuteResponse {
  job?: RedashJob;
  query_result?: RedashQueryResult;
}

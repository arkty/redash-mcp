import type { RedashClient } from "../client/redash-client.js";
import { JobStatus } from "../client/types.js";

export interface PollOptions {
  pollInterval: number;
  maxAttempts: number;
}

export async function pollQueryResult(
  client: RedashClient,
  jobId: string,
  options: PollOptions,
): Promise<number> {
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    const { job } = await client.getJob(jobId);

    switch (job.status) {
      case JobStatus.SUCCESS:
        if (job.query_result_id === null) {
          throw new Error("Job succeeded but no query_result_id returned");
        }
        return job.query_result_id;

      case JobStatus.FAILURE:
        throw new Error(`Query execution failed: ${job.error || "Unknown error"}`);

      case JobStatus.CANCELLED:
        throw new Error("Query execution was cancelled");

      case JobStatus.PENDING:
      case JobStatus.STARTED:
        await new Promise((resolve) =>
          setTimeout(resolve, options.pollInterval),
        );
        break;

      default:
        throw new Error(`Unknown job status: ${job.status}`);
    }
  }

  throw new Error(
    `Query execution timed out after ${options.maxAttempts * options.pollInterval / 1000}s`,
  );
}

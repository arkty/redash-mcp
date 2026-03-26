const BLOCKED_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "CALL",
  "MERGE",
  "REPLACE",
];

const BLOCKED_PATTERN = new RegExp(
  `\\b(${BLOCKED_KEYWORDS.join("|")})\\b`,
  "i",
);

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

export function validateReadOnlySQL(sql: string): {
  allowed: boolean;
  reason?: string;
} {
  const cleaned = stripComments(sql);
  const match = cleaned.match(BLOCKED_PATTERN);

  if (match) {
    return {
      allowed: false,
      reason: `Blocked: "${match[0]}" is not allowed. Only SELECT queries are permitted.`,
    };
  }

  return { allowed: true };
}

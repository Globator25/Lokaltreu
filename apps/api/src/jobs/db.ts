import { Client } from "pg";

export interface JobDbClient {
  query<T extends Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export async function createJobDbClient(): Promise<JobDbClient> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  const client = new Client({ connectionString });
  await client.connect();
  return {
    query: <T extends Record<string, unknown>>(text: string, params?: unknown[]) =>
      client.query<T>(text, params).then((result) => ({ rows: result.rows })),
    close: () => client.end(),
  };
}

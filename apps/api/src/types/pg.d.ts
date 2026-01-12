declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
    rows: T[];
  }

  export class Client {
    constructor(config: { connectionString: string });
    connect(): Promise<void>;
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}

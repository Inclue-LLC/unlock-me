import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __unlockmePool: Pool | undefined;
}

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://unlockme:unlockme@localhost:5432/unlockme",
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });
  // BIGINT / NUMERIC は文字列で返るため、件数・IDは呼び出し側で Number() する
  return pool;
}

export const pool: Pool = globalThis.__unlockmePool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__unlockmePool = pool;

export type Db = Pick<PoolClient, "query">;

export async function query<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query<T>(sql, params as any[]);
  return res.rows;
}

export async function one<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

/** トランザクション内で処理を実行する。例外時はロールバック。 */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

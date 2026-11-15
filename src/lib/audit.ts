import { query, type Db, pool } from "./db";

export interface Actor {
  id: number | null;
  label: string;
}

export const SYSTEM: Actor = { id: null, label: "system" };

/** 操作履歴（変更者・日時・変更内容）を記録する */
export async function audit(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string | number,
  detail: Record<string, unknown> = {},
  db: Db = pool,
) {
  await query(
    "INSERT INTO audit_logs (actor_id, actor_label, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5,$6)",
    [actor.id, actor.label, action, entity, String(entityId), JSON.stringify(detail)],
    db,
  );
}

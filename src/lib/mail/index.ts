import fs from "node:fs";
import path from "node:path";
import { one, query, type Db, pool } from "../db";
import { appUrl } from "../util";
import { DEFAULT_TEMPLATES, render } from "./templates";

export interface NotifyInput {
  /** イベント単位の一意キー。同じキーは二度送信しない。 */
  eventKey: string;
  userId: number | null;
  to: string;
  template: string;
  vars: Record<string, unknown>;
}

async function loadTemplate(key: string, db: Db) {
  const row = await one<{ subject: string; body: string }>("SELECT subject, body FROM email_templates WHERE key=$1", [key], db);
  if (row) return row;
  const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
  if (!def) throw new Error(`unknown template: ${key}`);
  return def;
}

/**
 * 通知をキューへ登録する（トランザクション内で呼び出し可能）。
 * event_key の一意制約で重複送信を防止する。登録された場合 true。
 */
export async function notify(input: NotifyInput, db: Db = pool): Promise<boolean> {
  const tpl = await loadTemplate(input.template, db);
  const vars = { appUrl: appUrl(), ...input.vars };
  const rows = await query(
    `INSERT INTO notifications (event_key, user_id, template, to_email, subject, body)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (event_key) DO NOTHING RETURNING id`,
    [input.eventKey, input.userId, input.template, input.to, render(tpl.subject, vars), render(tpl.body, vars)],
    db,
  );
  return rows.length > 0;
}

interface Transport {
  send(msg: { to: string; subject: string; text: string }): Promise<void>;
}

let transport: Transport | null = null;

async function getTransport(): Promise<Transport> {
  if (transport) return transport;
  if (process.env.MAIL_PROVIDER === "smtp" && process.env.SMTP_URL) {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport(process.env.SMTP_URL);
    const from = process.env.MAIL_FROM ?? "UNLOCK ME <no-reply@example.com>";
    transport = { send: async (m) => void (await t.sendMail({ from, ...m })) };
  } else {
    // 開発用: .mail/ ディレクトリへ書き出す
    const dir = path.join(process.cwd(), ".mail");
    transport = {
      send: async (m) => {
        if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${Date.now()}-${m.to.replace(/[^a-z0-9@.]/gi, "_")}.txt`);
        fs.writeFileSync(file, `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
      },
    };
  }
  return transport;
}

/** キュー済み通知を送信する。送信済み件数を返す。 */
export async function deliverQueued(limit = 100): Promise<number> {
  const t = await getTransport();
  let sent = 0;
  // 二重送信を避けるため、行ロックを取りつつ1件ずつ処理
  for (let i = 0; i < limit; i++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = await one<{ id: string; to_email: string; subject: string; body: string; attempts: number }>(
        `SELECT id, to_email, subject, body, attempts FROM notifications
          WHERE status='queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`,
        [],
        client,
      );
      if (!row) {
        await client.query("COMMIT");
        break;
      }
      try {
        await t.send({ to: row.to_email, subject: row.subject, text: row.body });
        await client.query("UPDATE notifications SET status='sent', sent_at=now(), attempts=attempts+1 WHERE id=$1", [row.id]);
        sent++;
      } catch (e) {
        const failed = row.attempts + 1 >= 5;
        await client.query("UPDATE notifications SET status=$2, attempts=attempts+1, error=$3 WHERE id=$1", [
          row.id,
          failed ? "failed" : "queued",
          String((e as Error).message).slice(0, 500),
        ]);
        if (!failed) {
          await client.query("COMMIT");
          break; // 一時的な障害の可能性があるため次回に回す
        }
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  return sent;
}

/** リクエスト処理後にバックグラウンドで送信（失敗してもworkerが再送する） */
export function kickDelivery() {
  deliverQueued(20).catch((e) => console.error("[mail] delivery failed", e));
}

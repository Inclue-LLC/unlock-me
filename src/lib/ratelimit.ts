import { one } from "./db";
import { UserError } from "./util";

/**
 * 固定ウィンドウ方式のレート制限（DB保存のため複数インスタンスでも有効）。
 * 制限超過時は UserError を投げる。
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const row = await one<{ count: number }>(
    `INSERT INTO rate_limits (key, count, window_ends) VALUES ($1, 1, now() + make_interval(secs => $2))
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_ends < now() THEN 1 ELSE rate_limits.count + 1 END,
       window_ends = CASE WHEN rate_limits.window_ends < now() THEN now() + make_interval(secs => $2) ELSE rate_limits.window_ends END
     RETURNING count`,
    [key, windowSec],
  );
  if (row && row.count > limit) {
    throw new UserError("短時間に操作が集中しています。しばらく時間をおいてから再度お試しください。");
  }
}

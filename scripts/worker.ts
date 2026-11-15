/**
 * 定期処理ワーカー（公開開始・募集終了と成立判定・成立後課金・再決済期限・通知配信）
 *   npm run worker            # 常駐（60秒間隔）
 *   npm run worker -- --once  # 1回だけ実行
 */
import { pool } from "../src/lib/db";
import { tick } from "../src/lib/settlement";

const INTERVAL = Number(process.env.WORKER_INTERVAL_SEC ?? 60) * 1000;

async function run() {
  try {
    const r = await tick();
    if (Object.values(r).some((v) => v > 0)) console.log(new Date().toISOString(), r);
  } catch (e) {
    console.error(new Date().toISOString(), "tick failed", e);
  }
}

if (process.argv.includes("--once")) {
  run().then(() => pool.end());
} else {
  console.log(`worker started (interval ${INTERVAL / 1000}s)`);
  let stopping = false;
  const loop = async () => {
    while (!stopping) {
      await run();
      await new Promise((r) => setTimeout(r, INTERVAL));
    }
    await pool.end();
  };
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
  loop();
}

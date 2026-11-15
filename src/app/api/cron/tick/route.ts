import { tick } from "@/lib/settlement";

export const dynamic = "force-dynamic";

/**
 * 定期処理エンドポイント（外部スケジューラから1分間隔で呼び出す）
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/tick
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await tick();
  return Response.json(result);
}

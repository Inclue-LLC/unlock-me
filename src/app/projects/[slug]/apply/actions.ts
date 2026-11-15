"use server";
import { act, clientIp, str } from "@/lib/action";
import { addAddress, parseAddress } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { kickDelivery } from "@/lib/mail";
import { createOrder } from "@/lib/orders";
import { getProjectBySlug } from "@/lib/projects";
import { rateLimit } from "@/lib/ratelimit";
import { UserError } from "@/lib/util";

export async function addAddressInlineAction(fd: FormData) {
  const slug = str(fd, "slug");
  const user = await requireUser();
  await act(`/projects/${slug}/apply`, async () => {
    const id = await addAddress(user.id, parseAddress(fd));
    return `/projects/${slug}/apply?address=${id}`;
  }, "配送先を登録しました");
}

export async function submitOrderAction(fd: FormData) {
  const slug = str(fd, "slug");
  const user = await requireUser(`/projects/${slug}`);
  const back = `/projects/${slug}/apply`;
  await act(back, async () => {
    const project = await getProjectBySlug(slug);
    if (!project) throw new UserError("プロジェクトが見つかりません");
    if (fd.get("agree") !== "on") throw new UserError("申込内容・注意事項への同意が必要です");
    const ip = await clientIp();
    // ボット・大量申込対策
    await rateLimit(`order:user:${user.id}`, 10, 600);
    if (ip) await rateLimit(`order:ip:${ip}`, 30, 600);

    const items: { variantId: number | null; quantity: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (k === "qty") items.push({ variantId: null, quantity: Number(v) });
      const m = /^v_(\d+)$/.exec(k);
      if (m) items.push({ variantId: Number(m[1]), quantity: Number(v) });
    }
    const { order } = await createOrder({
      userId: user.id,
      projectId: project.id,
      items,
      addressId: Number(str(fd, "address")),
      paymentMethodId: Number(str(fd, "pm")),
      idempotencyKey: str(fd, "idem").slice(0, 64) || crypto.randomUUID(),
      clientIp: ip,
    });
    kickDelivery();
    return `/mypage/orders/${order.id}?applied=1`;
  });
}

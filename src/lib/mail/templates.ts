/** メールテンプレートの初期値。運営管理画面から編集可能（email_templates テーブル）。 */
export interface TemplateDef {
  key: string;
  name: string;
  subject: string;
  body: string;
}

const FOOTER = `
──────────────
UNLOCK ME
「みんなで、欲しいものを解放する。」
{{appUrl}}
※本メールは送信専用です。`;

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  {
    key: "verify_email",
    name: "会員登録（メールアドレス認証）",
    subject: "【UNLOCK ME】メールアドレスの確認をお願いします",
    body: `{{name}} 様

UNLOCK ME へのご登録ありがとうございます。
以下のURLからメールアドレスの確認を完了してください（有効期限72時間）。

{{url}}
${FOOTER}`,
  },
  {
    key: "registered",
    name: "会員登録完了",
    subject: "【UNLOCK ME】会員登録が完了しました",
    body: `{{name}} 様

メールアドレスの確認が完了し、会員登録が完了しました。
気になる商品に参加して、みんなでUNLOCKしましょう！

{{appUrl}}
${FOOTER}`,
  },
  {
    key: "password_reset",
    name: "パスワード再設定",
    subject: "【UNLOCK ME】パスワード再設定のご案内",
    body: `{{name}} 様

パスワード再設定のリクエストを受け付けました。
以下のURLから1時間以内に新しいパスワードを設定してください。

{{url}}

お心当たりがない場合は、このメールを破棄してください。
${FOOTER}`,
  },
  {
    key: "order_applied",
    name: "購入申込受付",
    subject: "【UNLOCK ME】購入申込を受け付けました（{{orderNumber}}）",
    body: `{{name}} 様

以下の内容で購入申込を受け付けました。

■ 申込番号：{{orderNumber}}
■ プロジェクト：{{projectTitle}}
■ 内容：
{{items}}
■ 合計数量：{{quantity}}個
■ お支払い予定金額：{{amount}}（税込）
■ 募集終了：{{endsAt}}

本商品は申込数量が目標に達した場合に商品化されます。
決済は募集終了後、商品化が成立した時点で登録済みのお支払い方法に対して行います。
不成立の場合、申込は取り消され、代金は請求されません。

申込状況はマイページでご確認いただけます。
{{appUrl}}/mypage/orders/{{orderId}}
${FOOTER}`,
  },
  {
    key: "unlock_productization",
    name: "商品化UNLOCK",
    subject: "【UNLOCK ME】商品化がUNLOCKされました！「{{projectTitle}}」",
    body: `{{name}} 様

ご参加中の「{{projectTitle}}」の申込数量が {{targetQty}}個 に到達し、
「{{unlockTitle}}」がUNLOCKされました！

募集は {{endsAt}} まで続きます。さらに申込が増えると追加特典がUNLOCKされます。
ぜひSNSでシェアして仲間を増やしてください。

{{projectUrl}}

※最終的な成立・特典内容は募集終了後の有効申込数量で確定します。
${FOOTER}`,
  },
  {
    key: "unlock_reward",
    name: "追加特典UNLOCK",
    subject: "【UNLOCK ME】新しい特典がUNLOCKされました！「{{unlockTitle}}」",
    body: `{{name}} 様

ご参加中の「{{projectTitle}}」の申込数量が {{targetQty}}個 に到達し、
新たな特典「{{unlockTitle}}」がUNLOCKされました！

{{projectUrl}}

※最終的な特典内容は募集終了後の有効申込数量で確定します。
${FOOTER}`,
  },
  {
    key: "closing_soon",
    name: "募集終了間近",
    subject: "【UNLOCK ME】まもなく募集終了「{{projectTitle}}」",
    body: `{{name}} 様

ご参加中の「{{projectTitle}}」は {{endsAt}} に募集終了します。
現在の申込数量：{{totalQty}}個
{{nextUnlockText}}

{{projectUrl}}
${FOOTER}`,
  },
  {
    key: "project_succeeded",
    name: "成立のお知らせ",
    subject: "【UNLOCK ME】商品化が成立しました「{{projectTitle}}」",
    body: `{{name}} 様

「{{projectTitle}}」の募集が終了し、商品化が成立しました！
最終申込数量：{{finalQty}}個

■ 申込番号：{{orderNumber}}
■ 確定特典：
{{rewards}}

ご登録のお支払い方法で決済を行います。決済完了後、改めてご連絡いたします。
発送予定：{{shipEstimate}}

{{appUrl}}/mypage/orders/{{orderId}}
${FOOTER}`,
  },
  {
    key: "project_failed",
    name: "不成立のお知らせ",
    subject: "【UNLOCK ME】不成立のお知らせ「{{projectTitle}}」",
    body: `{{name}} 様

ご参加いただいた「{{projectTitle}}」は、募集終了時点で目標数量（{{minQty}}個）に届かなかったため、
誠に残念ながら不成立となりました。

申込番号 {{orderNumber}} は取り消されました。代金は請求されません。
ご参加いただき、ありがとうございました。
${FOOTER}`,
  },
  {
    key: "payment_failed",
    name: "決済失敗・お支払い方法更新のお願い",
    subject: "【UNLOCK ME】お支払い方法の更新をお願いします（{{orderNumber}}）",
    body: `{{name}} 様

「{{projectTitle}}」のご注文（{{orderNumber}}）の決済が完了できませんでした。
お手数ですが、{{dueAt}} までにマイページからお支払い方法を更新し、再決済を行ってください。
期限を過ぎた場合、ご注文は取り消しとなります。

{{appUrl}}/mypage/orders/{{orderId}}
${FOOTER}`,
  },
  {
    key: "payment_completed",
    name: "決済完了・注文確定",
    subject: "【UNLOCK ME】決済が完了し、ご注文が確定しました（{{orderNumber}}）",
    body: `{{name}} 様

「{{projectTitle}}」のご注文の決済が完了しました。
■ 申込番号：{{orderNumber}}
■ ご請求金額：{{amount}}（税込）
■ 発送予定：{{shipEstimate}}

商品の到着まで今しばらくお待ちください。
${FOOTER}`,
  },
  {
    key: "order_cancelled",
    name: "注文取消",
    subject: "【UNLOCK ME】ご注文を取り消しました（{{orderNumber}}）",
    body: `{{name}} 様

「{{projectTitle}}」のご注文（{{orderNumber}}）を取り消しました。
理由：{{reason}}
${FOOTER}`,
  },
  {
    key: "shipped",
    name: "発送完了",
    subject: "【UNLOCK ME】商品を発送しました（{{orderNumber}}）",
    body: `{{name}} 様

「{{projectTitle}}」のご注文商品を発送しました。
■ 配送会社：{{carrier}}
■ 追跡番号：{{trackingNumber}}

{{appUrl}}/mypage/orders/{{orderId}}
${FOOTER}`,
  },
];

export function render(tpl: string, vars: Record<string, unknown>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));
}

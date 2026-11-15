"use client";
import { useState } from "react";

/** SNS共有：X・LINE・URLコピー・端末の共有機能。Instagramは画像保存＋URLコピーで対応 */
export function ShareButtons({ url, text, image }: { url: string; text: string; image?: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("URLをコピーしてください", url);
    }
  };
  const native = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
      } catch {}
    } else copy();
  };
  const cls = "flex flex-col items-center gap-1 text-[11px] font-bold text-ink-soft";
  const icon = "flex h-11 w-11 items-center justify-center rounded-full text-white";
  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      <a className={cls} href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}&hashtags=UNLOCKME`} target="_blank" rel="noopener noreferrer">
        <span className={`${icon} bg-black`}>𝕏</span>X
      </a>
      <a className={cls} href={`https://social-plugins.line.me/lineit/share?url=${enc(url)}&text=${enc(text)}`} target="_blank" rel="noopener noreferrer">
        <span className={`${icon} bg-[#06C755] text-xs font-black`}>LINE</span>LINE
      </a>
      {image && (
        <a className={cls} href={image} download target="_blank" rel="noopener noreferrer" title="画像を保存してInstagramに投稿">
          <span className={`${icon} bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]`}>◎</span>画像保存
        </a>
      )}
      <button type="button" className={cls} onClick={copy}>
        <span className={`${icon} bg-lavender-500`}>🔗</span>
        {copied ? "コピーしました" : "URLコピー"}
      </button>
      <button type="button" className={cls} onClick={native}>
        <span className={`${icon} bg-pink-500`}>↗</span>その他
      </button>
    </div>
  );
}

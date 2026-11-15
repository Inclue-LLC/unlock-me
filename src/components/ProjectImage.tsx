/* eslint-disable @next/next/no-img-element */
/** 画像未設定時はブランドカラーのプレースホルダを表示 */
export function ProjectImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-[#F2F2F2] ${className ?? ""}`} aria-label={alt}>
        <span className="text-4xl">🧸</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}

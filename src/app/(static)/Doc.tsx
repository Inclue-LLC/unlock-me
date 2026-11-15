export function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-app max-w-3xl py-10">
      <h1 className="mb-6 text-2xl font-black">{title}</h1>
      <div className="card space-y-5 p-6 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </div>
  );
}

export function Draft() {
  return <p className="notice-info">※本ページは雛形です。公開前に販売主体・決済方式等の確定内容に合わせて法務確認のうえ差し替えてください。</p>;
}

import type { Metadata } from "next";
import { ProjectCard } from "@/components/ProjectCard";
import { listAllOpen } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "募集中のプロジェクト" };

export default async function ProjectsPage() {
  const list = await listAllOpen();
  return (
    <div className="container-app py-8">
      <h1 className="mb-6 text-2xl font-black">募集中のプロジェクト</h1>
      {list.length === 0 ? (
        <p className="card p-8 text-center text-sm text-ink-soft">現在募集中のプロジェクトはありません。</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
          {list.map((p) => <ProjectCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { query } from "@/lib/db";
import { createProjectAction } from "../../actions";
import { PageTitle } from "../../ui";
import { ProjectFields } from "../ProjectForm";

export const metadata = { title: "プロジェクト作成" };

export default async function NewProject({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const sellers = (await query("SELECT id, name FROM sellers WHERE status='active' ORDER BY name")).map((s) => ({ id: Number(s.id), name: s.name }));
  return (
    <>
      <PageTitle>プロジェクト作成</PageTitle>
      <Flash error={sp.error} />
      <form action={createProjectAction} className="card space-y-6 p-6">
        <ProjectFields sellers={sellers} />
        <SubmitButton className="btn-primary">下書きとして作成</SubmitButton>
      </form>
    </>
  );
}

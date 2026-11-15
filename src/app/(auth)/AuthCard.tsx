import { Logo } from "@/components/LockIcon";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-app flex justify-center py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <Logo className="text-lg" />
          <h1 className="mt-3 text-lg font-black">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

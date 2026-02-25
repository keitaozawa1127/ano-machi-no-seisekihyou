import { getPendingProjects } from "@/app/actions/redevelopment";
import MinimalistRedevelopment from "@/components/MinimalistRedevelopment";
import Link from "next/link";

export const metadata = {
  title: "Redevelopment Audit | Admin Console",
};

export default async function RedevelopmentAuditPage() {
  const pendingProjects = await getPendingProjects();

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4">Redevelopment Admin</h1>
      <MinimalistRedevelopment projects={pendingProjects} />
      <div className="mt-12 pt-8 border-t border-gray-200">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

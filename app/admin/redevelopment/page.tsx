import Link from "next/link";

export const metadata = {
  title: "Redevelopment Admin (Archived)",
};

export default function RedevelopmentAuditPage() {
  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4">Redevelopment Admin</h1>

      <div className="bg-green-50 text-green-800 p-6 rounded-lg text-sm border border-green-200">
        <p className="font-bold mb-2">データの統合が完了しました</p>
        <p>
          未承認の再開発データは、すべて各駅の個別JSONデータ（<code>public/data/stations/*.json</code>等）およびマスターデータに反映・統合されました。
        </p>
        <p className="mt-2">
          今後はJSONデータ側で再開発情報を直接管理するため、この仮承認用ページでの操作は不要です。
        </p>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

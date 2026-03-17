import AdminAuthGuard from "@/components/AdminAuthGuard";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AdminAuthGuard>{children}</AdminAuthGuard>;
}

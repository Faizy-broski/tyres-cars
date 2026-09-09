import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import type { ProfileRow } from "@/types/admin.types";

export const metadata: Metadata = {
  title: "Admin | Tyres & Car Valeting",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin/products");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as unknown as ProfileRow | null)?.role !== "super_admin")
    redirect("/");

  return (
    <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>
  );
}


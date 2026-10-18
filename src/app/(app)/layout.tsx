import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return <AppShell>{children}</AppShell>;
}

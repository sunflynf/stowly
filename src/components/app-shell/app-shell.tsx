import { ClientGate } from "./client-gate";
import { MobileTabBar } from "./mobile-tab-bar";
import { OfflineBanner } from "./offline-banner";
import { Sidebar } from "./sidebar";

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy>
      <div className="hidden w-60 shrink-0 border-r border-border bg-card md:block" />
      <div className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-4 md:px-10 md:pt-9">
        <div className="mb-6 h-9 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-[52px] animate-pulse rounded-[var(--radius)] bg-muted" />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ClientGate fallback={<ShellSkeleton />}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <OfflineBanner />
          <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-4 pb-28 md:px-10 md:pt-9 md:pb-12">
            {children}
          </main>
        </div>
        <MobileTabBar />
      </div>
    </ClientGate>
  );
}

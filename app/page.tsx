"use client";

import dynamic from "next/dynamic";

// The whole app runs in the browser (pdf.js, IndexedDB, localStorage), so it is never rendered on the server.
const AppShell = dynamic(() => import("@/components/app-shell"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-mute" role="status">
      Loading…
    </div>
  ),
});

export default function Page() {
  return <AppShell />;
}

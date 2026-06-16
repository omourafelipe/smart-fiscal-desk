import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./Sidebar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans antialiased">
      <Toaster richColors position="top-right" />
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto h-screen">{children}</main>
    </div>
  );
}

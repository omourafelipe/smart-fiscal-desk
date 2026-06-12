import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { useAuthStore } from "@/store/useAuthStore";
import { useTenantStore } from "@/store/useTenantStore";
import { SyncManager } from "@/lib/data-access/SyncManager";
import { ShieldAlert, RefreshCw } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Faturamento - Samel" },
      { name: "description", content: "Fiscal Insights Hub is a client-side fiscal BI dashboard that processes NFS-e Nacional XML files." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Faturamento - Samel" },
      { property: "og:description", content: "Fiscal Insights Hub is a client-side fiscal BI dashboard that processes NFS-e Nacional XML files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Faturamento - Samel" },
      { name: "twitter:description", content: "Fiscal Insights Hub is a client-side fiscal BI dashboard that processes NFS-e Nacional XML files." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/465d81c5-1864-4f2a-85c9-62bacceb44f5/id-preview-c1ca1c5d--105fc311-8974-4da9-a1da-0e084c0c7769.lovable.app-1781021670793.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/465d81c5-1864-4f2a-85c9-62bacceb44f5/id-preview-c1ca1c5d--105fc311-8974-4da9-a1da-0e084c0c7769.lovable.app-1781021670793.png" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const state = router.state;
  const isLoginPage = state.location.pathname === "/login";

  const { session, checkSession, isSupabaseConfigured } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (session?.user?.id) {
      useTenantStore.getState().fetchTenantData().then(() => {
        SyncManager.syncAll(session.user.id);
      });
    }
  }, [session]);

  return (
    <QueryClientProvider client={queryClient}>
      {isLoginPage ? (
        <Outlet />
      ) : (
        <LayoutShell>
          {!session && isSupabaseConfigured && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
                <span>
                  Você está rodando no <strong>Modo Local (Offline)</strong>. Crie uma conta ou faça login para habilitar a sincronização em nuvem.
                </span>
              </div>
              <Link
                to="/login"
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-bold px-3 py-1 rounded-xl transition-colors"
              >
                Fazer Login / Criar Conta
              </Link>
            </div>
          )}
          {session && isSupabaseConfigured && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-500" />
                <span>
                  Conectado à nuvem. Se faltarem notas, clique em <strong>Sincronizar agora</strong> para baixar tudo novamente.
                </span>
              </div>
              <button
                onClick={() => SyncManager.syncAll(session.user.id, true)}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold px-3 py-1 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sincronizar agora
              </button>
            </div>
          )}
          <Outlet />
        </LayoutShell>
      )}
    </QueryClientProvider>
  );
}

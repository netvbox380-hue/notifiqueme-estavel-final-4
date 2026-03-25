import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { registerServiceWorker } from "@/lib/pwa-register";

const queryClient = new QueryClient();

// Captura o prompt de instalação o mais cedo possível para não perder o evento no mobile
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    (window as any).__nmBeforeInstallPrompt = e;
  });

  window.addEventListener("appinstalled", () => {
    try {
      delete (window as any).__nmBeforeInstallPrompt;
    } catch {}
  });
}

const handleApiError = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (isUnauthorized) {
    console.warn("[Auth] Sessão expirada ou inválida.");

    if (window.location.pathname !== "/login") {
      console.log("[Auth] Redirecionando para login...");
      window.location.href = "/login";
    }
  }
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    handleApiError(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    handleApiError(error);
    console.error("[API Mutation Error]", error);
  }
});

const baseUrl = window.location.origin || "http://localhost:3000";

const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${baseUrl}/api/trpc`,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

// Registro centralizado do PWA / Service Worker
if (
  import.meta.env.PROD &&
  typeof window !== "undefined" &&
  "serviceWorker" in navigator
) {
  const registerPWAOnce = async () => {
    try {
      const reg = await registerServiceWorker();
      console.log("[PWA] Service Worker registrado com sucesso:", reg);

      // força checagem de atualização periódica
      setInterval(() => {
        void reg.update();
      }, 30000);
    } catch (error) {
      console.error("[PWA] Erro ao registrar Service Worker:", error);
    }
  };

  if (document.readyState === "complete") {
    void registerPWAOnce();
  } else {
    window.addEventListener("load", () => {
      void registerPWAOnce();
    }, { once: true });
  }
} else {
  console.warn("[PWA] Service Worker indisponível neste ambiente.");
}

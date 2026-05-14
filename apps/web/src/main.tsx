import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TolgeeProvider } from "@tolgee/react";
import { App } from "./App";
import { ToastProvider } from "./components/ui/toast";
import { tolgee } from "./lib/i18n";
import "./styles/globals.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TolgeeProvider
      tolgee={tolgee}
      // Render nothing until the active locale is ready. Bundles are static
      // so the wait is sub-frame; this just keeps SSR-like guarantees.
      fallback={null}
    >
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </TolgeeProvider>
  </React.StrictMode>,
);

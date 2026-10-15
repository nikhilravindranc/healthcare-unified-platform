"use client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useSettings } from "@/lib/settings";
import { applyTheme } from "@/lib/themes";

/** Applies the chosen colour theme to the whole page. */
function ThemeApplier() {
  const { theme } = useSettings();
  useEffect(() => { applyTheme(theme); }, [theme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <ThemeApplier />
      {children}
      <Toaster position="bottom-right" toastOptions={{ style: { fontSize: 13, color: "#26384B", border: "1px solid #E2E7EB" } }} />
    </QueryClientProvider>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { render } from "@testing-library/react";

export function renderWithProviders(ui: React.ReactElement, { route = "/" } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MemoryRouter initialEntries={[route]}>
          {ui}
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

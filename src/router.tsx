import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { routeTree } from "./routeTree.gen";

function DefaultRouterError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const errorPathRef = useRef(pathname);

  useEffect(() => {
    if (errorPathRef.current !== pathname) {
      errorPathRef.current = pathname;
      router.invalidate();
      reset();
    }
  }, [pathname, reset, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta tela
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atualize a página ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60_000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 0,
        // Evita que um erro transiente de fetch dispare o errorComponent do root
        // ("This page didn't load"). Componentes tratam o estado via `error`.
        throwOnError: false,
      },
      mutations: { throwOnError: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultRouterError,
  });

  return router;
};

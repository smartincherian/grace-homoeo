import { MutationCache, QueryClient } from "@tanstack/react-query";
import { FirebaseError } from "firebase/app";
import { notifyWriteDenied } from "./writeDenied";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  mutationCache: new MutationCache({
    onError: (err) => {
      if (err instanceof FirebaseError && err.code === "permission-denied") {
        notifyWriteDenied();
      }
    },
  }),
});

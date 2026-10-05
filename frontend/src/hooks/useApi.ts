import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ApiError } from "@/lib/api";

interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Fetch data on mount and whenever `deps` change. Previous data is kept while
 * a new request is in flight so filters update without flashing skeletons.
 * In-flight requests are aborted when deps change or the component unmounts.
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err as Error).name === "AbortError") return;
        setError(err instanceof ApiError ? err : new ApiError("Something went wrong.", 0));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, refetch, setData };
}

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Keeps list filters (search, status, page, ordering…) in the URL so views are
 * shareable and survive refreshes. Changing any filter resets to page 1.
 */
export function useListParams<K extends string>(keys: readonly K[], defaults: Partial<Record<K | "page" | "ordering", string>> = {}) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const result = {} as Record<K | "page" | "ordering", string>;
    [...keys, "page", "ordering"].forEach((key) => {
      result[key as K] = params.get(key) ?? defaults[key as K] ?? "";
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const set = useCallback(
    (updates: Partial<Record<K | "page" | "ordering", string>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(updates).forEach(([key, value]) => {
            if (value) next.set(key, value as string);
            else next.delete(key);
          });
          if (!("page" in updates)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const page = Number(values.page) || 1;
  return { values, set, page };
}

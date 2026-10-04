"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const corridor = params.get("corridor");

  const update = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => (value === null ? next.delete(key) : next.set(key, value)));
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return {
    corridor,
    openCorridor: (id: string) => update({ corridor: id }),
    closeCorridor: () => update({ corridor: null }),
  };
}

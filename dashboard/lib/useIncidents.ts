"use client";

import { useEffect, useState } from "react";
import type { IncidentCollection } from "./incidents";

export function useIncidents() {
  const [collection, setCollection] = useState<IncidentCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/incidents")
      .then((response) => {
        if (!response.ok) throw new Error(`incidents ${response.status}`);
        return response.json() as Promise<IncidentCollection>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.features.length === 0) throw new Error("incidents came back empty");
        setCollection(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load incidents");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { collection, error };
}

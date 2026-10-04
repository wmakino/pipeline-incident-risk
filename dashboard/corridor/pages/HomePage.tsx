"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { IncidentCollection } from "@/lib/incidents";
import type { Ranking } from "../api/types";
import { downloadRankingCsv } from "../lib/csv";
import { Hero } from "../sections/Hero";
import { StatsBar } from "../sections/StatsBar";
import { PriorityList } from "../sections/PriorityList";
import { MethodSection } from "../sections/MethodSection";
import { CtaBand } from "../sections/CtaBand";
import { CorridorDrawer } from "../features/drawer/CorridorDrawer";
import { MapPreview } from "@/map/MapPreview";
import { corridorDetail } from "@/lib/corridors";
import { transitionNavigate } from "@/lib/page-transition";
import "../sections/sections.css";

export function HomePage({
  collection,
  ranking,
  corridor,
  openCorridor,
  closeCorridor,
}: {
  collection: IncidentCollection | null;
  ranking: Ranking | null;
  corridor: string | null;
  openCorridor: (id: string) => void;
  closeCorridor: () => void;
}) {
  const router = useRouter();
  const rows = ranking?.rows ?? [];

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const timer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
    return () => clearTimeout(timer);
  }, []);

  const openMap = () => transitionNavigate(router, "/map");

  return (
    <>
      <Hero ranking={ranking} onMap={openMap} />
      <MapPreview collection={collection} />
      <StatsBar ranking={ranking} />
      <PriorityList
        ranking={ranking}
        collection={collection}
        loading={collection == null && ranking == null}
        onOpen={openCorridor}
      />
      <MethodSection />
      <CtaBand
        onExport={() => ranking && downloadRankingCsv(rows)}
        onMap={openMap}
      />
      {corridor && collection && (
        <CorridorDrawer
          detail={corridorDetail(collection, corridor)}
          order={rows}
          onClose={closeCorridor}
          onNavigate={openCorridor}
        />
      )}
    </>
  );
}

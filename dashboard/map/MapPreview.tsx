"use client";

import { useRouter } from "next/navigation";
import { LikelihoodMap } from "@/map/LikelihoodMap";
import type { IncidentCollection } from "@/lib/incidents";
import { onTransitionClick } from "@/lib/page-transition";

export function MapPreview({ collection }: { collection: IncidentCollection | null }) {
  const router = useRouter();
  return (
    <section className="map-band" aria-label="Incident map preview">
      <div className="map-band__frame">
        {collection ? (
          <LikelihoodMap
            collection={collection}
            mapSignal="risk"
            showPipelines
            preview
            onPipelines={() => undefined}
          />
        ) : null}
      </div>
      <div className="map-band__bar">
        <p>Each circle represents one incident. Blue indicates lower risk and red indicates higher risk. Gray circles have no consequence score.</p>
        <a href="/map" className="btn btn--primary" onClick={onTransitionClick(router, "/map")}>Open the map</a>
      </div>
    </section>
  );
}

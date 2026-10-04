"use client";

import { useMemo } from "react";
import { useTheme } from "@/corridor/hooks/useTheme";
import { useUrlState } from "@/corridor/hooks/useUrlState";
import { Nav } from "@/corridor/components/Nav";
import { Footer } from "@/corridor/components/Footer";
import { HomePage } from "@/corridor/pages/HomePage";
import { AboutPage } from "@/corridor/pages/AboutPage";
import { rankCorridors } from "@/lib/corridors";
import { useIncidents } from "@/lib/useIncidents";
import "@/corridor/styles/tokens.css";
import "@/corridor/styles/global.css";

export function CorridorSite({ page }: { page: "home" | "about" }) {
  const { theme } = useTheme();
  const { corridor, openCorridor, closeCorridor } = useUrlState();
  const { collection, error } = useIncidents();

  const ranking = useMemo(
    () => (collection ? rankCorridors(collection) : null),
    [collection],
  );

  return (
    <div className="corridor-root" data-theme={theme}>
      <a href="#main" className="sr-only">Skip to content</a>
      <Nav />
      <main id="main">
        {error ? <p className="container section">{error}</p> : null}
        {page === "home" ? (
          <HomePage
            collection={collection}
            ranking={ranking}
            corridor={corridor}
            openCorridor={openCorridor}
            closeCorridor={closeCorridor}
          />
        ) : (
          <AboutPage />
        )}
      </main>
      <Footer />
    </div>
  );
}

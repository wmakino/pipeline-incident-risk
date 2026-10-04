"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/corridor/components/Nav";
import { useTheme } from "@/corridor/hooks/useTheme";
import { summarize, type MapSignal } from "@/lib/incidents";
import { onTransitionClick } from "@/lib/page-transition";
import { useIncidents } from "@/lib/useIncidents";
import { LikelihoodMap } from "@/map/LikelihoodMap";
import { ConsequenceBrackets, LikelihoodBrackets, SignalLegend } from "@/map/panel";
import "@/corridor/styles/tokens.css";
import "@/corridor/styles/global.css";
import "@/map/map.css";

const SIGNAL_OPTIONS: { id: MapSignal; label: string }[] = [
  { id: "likelihood", label: "Likelihood" },
  { id: "consequence", label: "Consequence" },
  { id: "risk", label: "Risk" },
];

export function LikelihoodDashboard() {
  const { collection, error } = useIncidents();
  const [mapSignal, setMapSignal] = useState<MapSignal>("risk");
  const [showPanel, setShowPanel] = useState(true);
  const [showPipelines, setShowPipelines] = useState(true);
  const [pipelineCount, setPipelineCount] = useState<number | null>(null);
  const [pipelineError, setPipelineError] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const summary = useMemo(() => (collection ? summarize(collection) : null), [collection]);

  return (
    <div className="corridor-root map-page" data-theme={theme}>
      <Nav />
      <main className={showPanel ? "shell" : "shell panel-hidden"}>
        <aside className="panel" aria-hidden={showPanel ? undefined : true}>
          <div className="panel-body">
            <div className="panel-head">
              <h1>Incident risk</h1>
              <button type="button" className="panel-hide" onClick={() => setShowPanel(false)}>
                Hide
              </button>
            </div>
            <p>
              Each circle is one incident from the CER pipeline incident file. Risk is likelihood
              times consequence, and only when both exist. Consequence starts from the release.
              A scored criticality and a scored groundwater impact count equally with it. A
              reading that was not scored is left out, and a low reading does not pull the
              release down. The map color
              follows the selected part. Blue is lower and red is higher. A gray circle has no
              consequence, so it has no risk. This is not a safety certificate and not a repair
              design. A circle also carries Alberta's aquifer vulnerability index, from 1 to 6.
              That index is not part of the risk score.
            </p>
            <fieldset className="signal-toggle">
              <legend>Map color</legend>
              {SIGNAL_OPTIONS.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="map-signal"
                    value={option.id}
                    checked={mapSignal === option.id}
                    onChange={() => setMapSignal(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            {collection ? <SignalLegend collection={collection} signal={mapSignal} /> : null}
            <LikelihoodBrackets />
            <ConsequenceBrackets />
            {summary ? (
              <>
                <label className="lines-toggle">
                  <input
                    type="checkbox"
                    checked={showPipelines && !pipelineError}
                    disabled={pipelineError || pipelineCount == null}
                    onChange={(event) => setShowPipelines(event.target.checked)}
                  />
                  <span className="line-sample" aria-hidden="true" />
                  <span>CER pipeline systems</span>
                </label>
                <p className="muted">
                  {pipelineError
                    ? "CER pipeline systems did not load. Incident circles are still shown. The lines are not part of the score."
                    : pipelineCount == null
                      ? "Loading CER pipeline systems for this view. They are not part of the score."
                      : `${pipelineCount.toLocaleString("en-CA")} CER pipeline systems, fetched for this view and not kept in this project. They are not part of the score.`}
                </p>
                <p className="muted">
                  {summary.plotted.toLocaleString("en-CA")} incidents plotted. Reported {summary.first}{" "}
                  through {summary.last}. Source: CER pipeline incidents comprehensive data.
                </p>
              </>
            ) : (
              <p className="muted">{error ?? "Loading incidents"}</p>
            )}
          </div>
        </aside>
        <div className="map-wrap">
          <button
            type="button"
            className={showPanel ? "panel-show is-hidden" : "panel-show"}
            onClick={() => setShowPanel(true)}
            tabIndex={showPanel ? -1 : 0}
            aria-hidden={showPanel}
          >
            Show panel
          </button>
          <a href="/" className="map-close" onClick={onTransitionClick(router, "/")}>
            Close
          </a>
          {collection ? (
            <LikelihoodMap
              collection={collection}
              mapSignal={mapSignal}
              showPipelines={showPipelines}
              onPipelines={(status) => {
                if (status.ok) {
                  setPipelineCount(status.count);
                  setPipelineError(false);
                } else {
                  setPipelineError(true);
                }
              }}
            />
          ) : (
            <div className="map" />
          )}
        </div>
      </main>
    </div>
  );
}

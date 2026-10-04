import { useEffect, useRef } from "react";
import type { IncidentProperties } from "@/lib/incidents";
import { riskFactors } from "@/lib/riskBreakdown";
import { Button } from "../../components/ui";
import { RiskFactors } from "./RiskFactors";
import "./drawer.css";

export function IncidentDrawer({ item, onClose }: { item: IncidentProperties; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const report = riskFactors(item);

  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      height: body.style.height,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.height = "auto";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.height = prev.height;
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="incident-drawer-title">
        <header className="drawer__header">
          <div className="drawer__title">
            <div>
              <span className="caption text-muted">Top 15 risk / {item.incident_id}</span>
              <h2 id="incident-drawer-title" className="h3 drawer__name">
                {item.release_type || "Incident"}
              </h2>
              <span className="caption text-muted">
                {item.reported}
                {item.nearest_populated_centre ? `, ${item.nearest_populated_centre}` : ""}
              </span>
            </div>
          </div>
          <Button ref={closeRef} size="sm" icon onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </header>
        <div className="drawer__body">
          <div className="drawer__panel">
            <RiskFactors likelihood={report.likelihood} consequence={report.consequence} product={report.product} />
          </div>
        </div>
      </aside>
    </div>
  );
}

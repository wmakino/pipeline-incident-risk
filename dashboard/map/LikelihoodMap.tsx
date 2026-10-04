"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { cutDistanceMetres, cutTree, fitTree, type ClusterPoint } from "@/lib/cluster";
import {
  signalColor,
  signalLabel,
  signalRadius,
  signalTextColor,
  signalValue,
  type IncidentCollection,
  type MapSignal,
} from "@/lib/incidents";
import { escapeHtml, incidentPopup, linePopup } from "@/map/popup";
import "@/map/map.css";

const PIPELINE_URL =
  "https://services5.arcgis.com/vNzamREXvX2WcX6d/ArcGIS/rest/services/CER_Pipeline_Systems_WGS84_view/FeatureServer/3/query?where=1%3D1&outFields=Pipeline_Name,Company,Commodity&f=geojson";

const PIPELINE_COLOR = "#31404d";
const POSITRON_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const LABEL_FONT = [
  "Montserrat Medium",
  "Open Sans Bold",
  "Noto Sans Regular",
  "HanWangHeiLight Regular",
  "NanumBarunGothic Regular",
];

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type PipelineStatus = { ok: true; count: number } | { ok: false };

type LikelihoodMapProps = {
  collection: IncidentCollection;
  mapSignal: MapSignal;
  showPipelines: boolean;
  onPipelines: (status: PipelineStatus) => void;
  preview?: boolean;
};

type LineKind = "cer";

function clusterBaseRadius(count: number): number {
  const digits = String(count).length;
  return Math.min(28, 12 + digits * 2 + Math.sqrt(count));
}

function tagLines(features: GeoJSON.Feature[], kind: LineKind): GeoJSON.Feature[] {
  return features
    .filter((feature) => feature.geometry)
    .map((feature) => ({
      ...feature,
      properties: { ...(feature.properties ?? {}), _kind: kind },
    }));
}

function asCollection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

export function LikelihoodMap({
  collection,
  mapSignal,
  showPipelines,
  onPipelines,
  preview = false,
}: LikelihoodMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const signalRef = useRef(mapSignal);
  const redrawRef = useRef<() => void>(() => {});
  const showRef = useRef(showPipelines);
  const onPipelinesRef = useRef(onPipelines);
  const [ready, setReady] = useState(false);

  signalRef.current = mapSignal;
  showRef.current = showPipelines;
  onPipelinesRef.current = onPipelines;

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    const controller = new AbortController();
    let drawFrame = 0;
    let incidentSignature = "";
    setReady(false);

    const points: ClusterPoint[] = collection.features.map((feature) => ({
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      signal: 0,
    }));
    const tree = fitTree(points);

    function incidentFeatures(latitude: number, zoom: number): GeoJSON.FeatureCollection {
      const mode = signalRef.current;
      for (let index = 0; index < points.length; index++) {
        points[index].signal = signalValue(collection.features[index].properties, mode) ?? 0;
      }
      const groups = cutTree(points, tree, cutDistanceMetres(latitude, zoom));
      const features: GeoJSON.Feature[] = [];
      for (const group of groups) {
        if (group.members.length === 1) {
          const item = collection.features[group.members[0]].properties;
          const value = signalValue(item, mode);
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [group.lon, group.lat] },
            properties: {
              kind: "single",
              base: signalRadius(value, mode),
              color: signalColor(value, mode),
              popup: incidentPopup(item),
            },
          });
          continue;
        }
        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;
        for (const index of group.members) {
          west = Math.min(west, points[index].lon);
          south = Math.min(south, points[index].lat);
          east = Math.max(east, points[index].lon);
          north = Math.max(north, points[index].lat);
        }
        const count = group.members.length;
        const highest = group.signal > 0 ? group.signal : null;
        const countLabel = count.toLocaleString("en-CA");
        const title = mode === "likelihood" ? "Likelihood" : mode === "consequence" ? "Consequence" : "Risk";
        const tooltip = highest == null
          ? `${countLabel} incidents. ${title} not scored`
          : `${countLabel} incidents. Highest ${mode} ${signalLabel(highest, mode)}`;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [group.lon, group.lat] },
          properties: {
            kind: "cluster",
            base: clusterBaseRadius(count),
            color: signalColor(highest, mode),
            textColor: signalTextColor(highest, mode),
            count: countLabel,
            tooltip,
            west,
            south,
            east,
            north,
          },
        });
      }
      return { type: "FeatureCollection", features };
    }

    async function draw() {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !element) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      map = new maplibregl.Map({
        container: element,
        style: POSITRON_STYLE,
        center: [-96, 62],
        zoom: 3,
        attributionControl: { compact: false },
        scrollZoom: !preview,
      });
      if (!preview) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      }
      mapRef.current = map;

      const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" });
      const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: "240px" });

      function setSource(id: string, data: GeoJSON.FeatureCollection) {
        const source = map?.getSource(id) as import("maplibre-gl").GeoJSONSource | undefined;
        source?.setData(data);
      }

      function drawIncidents() {
        if (!map?.getSource("incidents")) return;
        const data = incidentFeatures(map.getCenter().lat, map.getZoom());
        let signature = "";
        for (const feature of data.features) {
          const coords = feature.geometry?.type === "Point" ? feature.geometry.coordinates : [0, 0];
          const props = feature.properties ?? {};
          signature += `${props.kind}:${props.color}:${props.base}:${props.count ?? ""}:${Number(coords[0]).toFixed(3)}:${Number(coords[1]).toFixed(3)}|`;
        }
        if (signature === incidentSignature) return;
        incidentSignature = signature;
        setSource("incidents", data);
      }

      redrawRef.current = drawIncidents;

      function scheduleIncidents() {
        if (drawFrame) return;
        drawFrame = window.requestAnimationFrame(() => {
          drawFrame = 0;
          drawIncidents();
        });
      }

      map.on("load", () => {
        if (!map || cancelled) return;
        const view = map;
        map.addSource("cer", { type: "geojson", data: EMPTY });
        map.addSource("incidents", { type: "geojson", data: EMPTY });

        map.addLayer({
          id: "cer-lines",
          type: "line",
          source: "cer",
          layout: { visibility: showRef.current ? "visible" : "none" },
          paint: { "line-color": PIPELINE_COLOR, "line-width": 2.5, "line-opacity": 0.95 },
        });
        map.addLayer({
          id: "singles",
          type: "circle",
          source: "incidents",
          filter: ["==", ["get", "kind"], "single"],
          paint: {
            "circle-radius": [
              "step",
              ["zoom"],
              ["max", 2, ["*", ["get", "base"], 0.4]],
              4.0001,
              ["max", 2, ["*", ["get", "base"], 0.65]],
              5.0001,
              ["max", 2, ["*", ["get", "base"], 0.85]],
              6.0001,
              ["max", 2, ["get", "base"]],
            ],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.88,
            "circle-stroke-width": ["step", ["zoom"], 0, 5.0001, 0.6],
            "circle-stroke-color": ["get", "color"],
          },
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "incidents",
          filter: ["==", ["get", "kind"], "cluster"],
          paint: {
            "circle-radius": [
              "step",
              ["zoom"],
              ["*", ["get", "base"], 0.7],
              4.0001,
              ["*", ["get", "base"], 0.85],
              6.0001,
              ["get", "base"],
            ],
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "cluster-counts",
          type: "symbol",
          source: "incidents",
          filter: ["==", ["get", "kind"], "cluster"],
          layout: {
            "text-field": ["get", "count"],
            "text-font": LABEL_FONT,
            "text-size": 11,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": ["get", "textColor"] },
        });

        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;
        for (const point of points) {
          west = Math.min(west, point.lon);
          south = Math.min(south, point.lat);
          east = Math.max(east, point.lon);
          north = Math.max(north, point.lat);
        }
        if (Number.isFinite(west)) {
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 24, duration: 0 },
          );
        }
        drawIncidents();
        setReady(true);

        const hoverLayers = ["singles", "clusters", "cer-lines"];
        for (const layer of hoverLayers) {
          map.on("mouseenter", layer, () => {
            view.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            view.getCanvas().style.cursor = "";
            if (layer === "clusters") tooltip.remove();
          });
        }
        map.on("mousemove", "clusters", (event) => {
          const text = event.features?.[0]?.properties?.tooltip;
          if (typeof text !== "string") return;
          tooltip.setLngLat(event.lngLat).setHTML(escapeHtml(text)).addTo(view);
        });
        map.on("click", "singles", (event) => {
          const html = event.features?.[0]?.properties?.popup;
          if (typeof html !== "string") return;
          popup.setLngLat(event.lngLat).setHTML(html).addTo(view);
        });
        map.on("click", "clusters", (event) => {
          const props = event.features?.[0]?.properties;
          if (!props) return;
          const westBound = Number(props.west);
          const southBound = Number(props.south);
          const eastBound = Number(props.east);
          const northBound = Number(props.north);
          if (![westBound, southBound, eastBound, northBound].every(Number.isFinite)) return;
          view.fitBounds(
            [
              [westBound, southBound],
              [eastBound, northBound],
            ],
            { padding: 48, maxZoom: view.getZoom() + 3 },
          );
        });
        const openLine = (event: import("maplibre-gl").MapLayerMouseEvent) => {
          const props = (event.features?.[0]?.properties ?? {}) as Record<string, unknown>;
          if (props._kind !== "cer") return;
          popup.setLngLat(event.lngLat).setHTML(linePopup(props)).addTo(view);
        };
        map.on("click", "cer-lines", openLine);
        map.on("zoom", scheduleIncidents);
        map.on("zoomend", drawIncidents);
      });

      void fetch(PIPELINE_URL, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`CER pipelines ${response.status}`);
          return response.json() as Promise<GeoJSON.FeatureCollection>;
        })
        .then((data) => {
          if (cancelled || !map) return;
          const features = tagLines(data.features ?? [], "cer");
          if (features.length === 0) throw new Error("CER pipelines returned no lines");
          const apply = () => setSource("cer", asCollection(features));
          if (map.isStyleLoaded() && map.getSource("cer")) apply();
          else map.once("load", apply);
          onPipelinesRef.current({ ok: true, count: features.length });
        })
        .catch((caught: unknown) => {
          if (cancelled || (caught instanceof DOMException && caught.name === "AbortError")) return;
          onPipelinesRef.current({ ok: false });
        });
    }

    void draw();

    return () => {
      cancelled = true;
      redrawRef.current = () => {};
      controller.abort();
      window.cancelAnimationFrame(drawFrame);
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [collection, preview]);

  useEffect(() => {
    redrawRef.current();
  }, [mapSignal, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("cer-lines")) return;
    map.setLayoutProperty("cer-lines", "visibility", showPipelines ? "visible" : "none");
  }, [showPipelines, ready]);

  return <div ref={container} className="map" role="region" aria-label="Incident risk map" />;
}

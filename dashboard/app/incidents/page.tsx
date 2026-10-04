import type { Metadata } from "next";
import { IncidentRecords } from "@/incidents/IncidentRecords";

export const metadata: Metadata = {
  title: "Incident records",
};

export default function IncidentsPage() {
  return <IncidentRecords />;
}

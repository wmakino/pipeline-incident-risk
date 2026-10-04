import type { Metadata } from "next";
import { LikelihoodDashboard } from "@/map/LikelihoodDashboard";

export const metadata: Metadata = {
  title: "Incident risk",
};

export default function MapPage() {
  return <LikelihoodDashboard />;
}

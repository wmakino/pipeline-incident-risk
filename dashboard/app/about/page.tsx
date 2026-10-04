import { Suspense } from "react";
import { CorridorSite } from "@/corridor/CorridorSite";

export default function About() {
  return (
    <Suspense fallback={null}>
      <CorridorSite page="about" />
    </Suspense>
  );
}

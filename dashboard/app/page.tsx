import { Suspense } from "react";
import { CorridorSite } from "@/corridor/CorridorSite";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CorridorSite page="home" />
    </Suspense>
  );
}

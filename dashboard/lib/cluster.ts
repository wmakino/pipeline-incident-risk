export type ClusterPoint = {
  lon: number;
  lat: number;
  signal: number;
};

export type Merge = {
  left: number;
  right: number;
  distance: number;
  count: number;
};

export type ClusterTree = {
  merges: Merge[];
  pointCount: number;
};

export type ClusterGroup = {
  members: number[];
  signal: number;
  lon: number;
  lat: number;
};

const EARTH_RADIUS_M = 6_371_008.8;

export function haversineMetres(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function fitTree(points: ClusterPoint[]): ClusterTree {
  const n = points.length;
  if (n <= 1) return { merges: [], pointCount: n };

  const stride = 2 * n;
  const distances = new Float64Array(stride * stride);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const metres = haversineMetres(points[i].lon, points[i].lat, points[j].lon, points[j].lat);
      distances[i * stride + j] = metres;
      distances[j * stride + i] = metres;
    }
  }

  const active = new Uint8Array(stride);
  active.fill(1, 0, n);
  const size = new Uint32Array(stride);
  size.fill(1, 0, n);
  const merges: Merge[] = [];
  const chain: number[] = [];
  let activeCount = n;

  function nearest(id: number): number {
    let best = -1;
    let bestDistance = Infinity;
    const limit = n + merges.length;
    for (let other = 0; other < limit; other++) {
      if (!active[other] || other === id) continue;
      const metres = distances[id * stride + other];
      if (metres < bestDistance || (metres === bestDistance && other < best)) {
        bestDistance = metres;
        best = other;
      }
    }
    return best;
  }

  while (activeCount > 1) {
    if (chain.length === 0) {
      for (let id = 0; id < n + merges.length; id++) {
        if (active[id]) {
          chain.push(id);
          break;
        }
      }
    }
    const current = chain[chain.length - 1];
    const neighbor = nearest(current);
    if (neighbor < 0) break;
    if (chain.length >= 2 && neighbor === chain[chain.length - 2]) {
      chain.pop();
      chain.pop();
      const distance = distances[current * stride + neighbor];
      const newId = n + merges.length;
      const limit = newId;
      for (let other = 0; other < limit; other++) {
        if (!active[other]) continue;
        const merged = Math.max(
          distances[current * stride + other],
          distances[neighbor * stride + other],
        );
        distances[newId * stride + other] = merged;
        distances[other * stride + newId] = merged;
      }
      active[current] = 0;
      active[neighbor] = 0;
      active[newId] = 1;
      size[newId] = size[current] + size[neighbor];
      activeCount -= 1;
      merges.push({
        left: current,
        right: neighbor,
        distance,
        count: size[newId],
      });
    } else if (chain.length > activeCount + 1) {
      throw new Error("Complete-linkage chain did not find a reciprocal pair");
    } else {
      chain.push(neighbor);
    }
  }

  return { merges, pointCount: n };
}

export function cutTree(points: ClusterPoint[], tree: ClusterTree, thresholdMetres: number): ClusterGroup[] {
  const n = points.length;
  if (n === 0) return [];
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  function find(index: number): number {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    let cursor = index;
    while (parent[cursor] !== root) {
      const next = parent[cursor];
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  }

  const representative = new Int32Array(n + tree.merges.length);
  for (let i = 0; i < n; i++) representative[i] = i;
  tree.merges.forEach((merge, index) => {
    const leftPoint = representative[merge.left];
    const rightPoint = representative[merge.right];
    representative[n + index] = leftPoint;
    if (merge.distance <= thresholdMetres) {
      parent[find(leftPoint)] = find(rightPoint);
    }
  });

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const members = groups.get(root);
    if (members) members.push(i);
    else groups.set(root, [i]);
  }

  return [...groups.values()].map((members) => {
    let signal = Number.NEGATIVE_INFINITY;
    let lat = 0;
    let lon = 0;
    for (const index of members) {
      const point = points[index];
      signal = Math.max(signal, point.signal);
      lat += point.lat;
      lon += point.lon;
    }
    return {
      members,
      signal,
      lat: lat / members.length,
      lon: lon / members.length,
    };
  });
}

export function memberSets(groups: ClusterGroup[]): number[][] {
  return groups
    .map((group) => [...group.members].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0] || a.length - b.length);
}

export const CLUSTER_PIXELS = 40;

export function cutDistanceMetres(latitude: number, zoom: number): number {
  const metresPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return CLUSTER_PIXELS * metresPerPixel;
}

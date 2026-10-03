import assert from "node:assert/strict";
import test from "node:test";
import { cutTree, fitTree, haversineMetres, memberSets, type ClusterPoint } from "./cluster.ts";

function offset(lon: number, lat: number, eastMetres: number, northMetres: number) {
  const latRadians = (lat * Math.PI) / 180;
  return {
    lon: lon + (eastMetres / (6_371_008.8 * Math.cos(latRadians))) * (180 / Math.PI),
    lat: lat + (northMetres / 6_371_008.8) * (180 / Math.PI),
  };
}

test("two close points merge before a point five kilometres away", () => {
  const origin = { lon: -114, lat: 51 };
  const close = offset(origin.lon, origin.lat, 50, 0);
  const far = offset(origin.lon, origin.lat, 5_000, 0);
  const points: ClusterPoint[] = [
    { ...origin, signal: 1 },
    { ...close, signal: 1 },
    { ...far, signal: 1 },
  ];
  const tree = fitTree(points);
  assert.equal(tree.merges.length, 2);
  assert.ok(tree.merges[0].distance > 40 && tree.merges[0].distance < 70);
  assert.ok(tree.merges[1].distance > 4_900 && tree.merges[1].distance < 5_200);
  assert.deepEqual(memberSets(cutTree(points, tree, 100)), [[0, 1], [2]]);
  assert.deepEqual(memberSets(cutTree(points, tree, 10_000)), [[0, 1, 2]]);
  assert.deepEqual(memberSets(cutTree(points, tree, 10)), [[0], [1], [2]]);
});

test("a chain stays split until every member is within the cut", () => {
  const origin = { lon: -114, lat: 51 };
  const middle = offset(origin.lon, origin.lat, 100, 0);
  const end = offset(origin.lon, origin.lat, 200, 0);
  const points: ClusterPoint[] = [
    { ...origin, signal: 1 },
    { ...middle, signal: 1 },
    { ...end, signal: 1 },
  ];
  const wide = cutTree(points, fitTree(points), 150);
  assert.deepEqual(memberSets(wide), [[0, 1], [2]]);
  const joined = cutTree(points, fitTree(points), 250);
  assert.deepEqual(memberSets(joined), [[0, 1, 2]]);
});

test("the signal does not change who joins, and the group keeps the highest signal", () => {
  const origin = { lon: -114, lat: 51 };
  const close = offset(origin.lon, origin.lat, 50, 0);
  const far = offset(origin.lon, origin.lat, 5_000, 0);
  const low: ClusterPoint[] = [
    { ...origin, signal: 1 },
    { ...close, signal: 9 },
    { ...far, signal: 1 },
  ];
  const flat: ClusterPoint[] = [
    { ...origin, signal: 3 },
    { ...close, signal: 3 },
    { ...far, signal: 3 },
  ];
  const lowTree = fitTree(low);
  const flatTree = fitTree(flat);
  assert.deepEqual(
    lowTree.merges.map((merge) => Math.round(merge.distance)),
    flatTree.merges.map((merge) => Math.round(merge.distance)),
  );
  assert.deepEqual(memberSets(cutTree(low, lowTree, 100)), memberSets(cutTree(flat, flatTree, 100)));
  const lowGroup = cutTree(low, lowTree, 100).find((group) => group.members.length === 2);
  const flatGroup = cutTree(flat, flatTree, 100).find((group) => group.members.length === 2);
  assert.equal(lowGroup?.signal, 9);
  assert.equal(flatGroup?.signal, 3);
});

test("a tighter cut splits a group into the nested pair", () => {
  const origin = { lon: -114, lat: 51 };
  const points: ClusterPoint[] = [
    { ...origin, signal: 2 },
    { ...offset(origin.lon, origin.lat, 50, 0), signal: 4 },
    { ...offset(origin.lon, origin.lat, 5_000, 0), signal: 1 },
  ];
  const tree = fitTree(points);
  const wide = memberSets(cutTree(points, tree, 10_000))[0];
  const tight = memberSets(cutTree(points, tree, 100));
  const pair = tight.find((members) => members.length === 2);
  assert.ok(pair);
  assert.ok(pair.every((index) => wide.includes(index)));
});

test("identical coordinates merge at zero metres", () => {
  const points: ClusterPoint[] = [
    { lon: -114, lat: 51, signal: 1 },
    { lon: -114, lat: 51, signal: 5 },
  ];
  const tree = fitTree(points);
  assert.ok(tree.merges[0].distance < 1);
  assert.equal(cutTree(points, tree, 0).find((group) => group.members.length === 2)?.signal, 5);
});

test("haversine of one point is zero", () => {
  assert.equal(haversineMetres(-114, 51, -114, 51), 0);
});

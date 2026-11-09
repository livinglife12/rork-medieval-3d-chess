/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { Bone, Box3, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PieceKind } from "../core/types";
import { attachWeapons } from "./weapons";
import { ARMY_SKINS } from "../assets/generated";

it.each([
  ["ashen-zombie-male.glb", "SwordSlash"],
  ["ashen-zombie-female.glb", "Shoot_OneHanded"],
] as const)("loads %s with Ashen officer animations", async (file, attack) => {
  const bytes = readFileSync(resolve("public/assets/models", file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  const bones: Bone[] = [];
  let skinnedMeshes = 0;
  gltf.scene.traverse((node) => {
    if ((node as Bone).isBone) bones.push(node as Bone);
    if ((node as SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
  });
  const clips = new Set(gltf.animations.map((clip) => clip.name));
  expect(skinnedMeshes).toBeGreaterThan(0);
  expect(bones.length).toBeGreaterThan(15);
  expect(bones.some((bone) => /FistR$/.test(bone.name))).toBe(true);
  for (const name of ["Idle", "Walk", "Run", attack, "Death"]) expect(clips.has(name), name).toBe(true);
});

it("routes Ashen attacks through faction choreography instead of shared source clips", () => {
  for (const kind of ["k", "q", "b", "n", "r", "p"] as PieceKind[]) {
    expect(ARMY_SKINS.undead.animated[kind]?.attack).toBeUndefined();
  }
});

it.each([
  ["ashen-zombie-male.glb", "k", "greatsword"],
  ["ashen-zombie-female.glb", "q", "scepter"],
  ["ashen-zombie-female.glb", "b", "crystalStaff"],
  ["ashen-zombie-male.glb", "n", "longsword"],
  ["ashen-zombie-male.glb", "r", "warhammer"],
] as const)("keeps the %s %s weapon within the character silhouette", async (file, kind, weapon) => {
  const bytes = readFileSync(resolve("public/assets/models", file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  gltf.scene.updateMatrixWorld(true);
  const bodyBounds = new Box3().setFromObject(gltf.scene, true);
  const height = bodyBounds.getSize(new Vector3()).y;
  attachWeapons(gltf.scene, kind as PieceKind, "w", height, bodyBounds.min.y, "undead");
  gltf.scene.updateMatrixWorld(true);
  const group = gltf.scene.getObjectByName(`weapon_${weapon}`);
  expect(group?.parent?.name).toMatch(/FistR$/);
  const weaponSize = new Box3().setFromObject(group!, true).getSize(new Vector3());
  expect(Math.max(weaponSize.x, weaponSize.y, weaponSize.z)).toBeLessThan(height * 1.6);
});

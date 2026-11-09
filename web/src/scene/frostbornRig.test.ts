/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { Bone, Box3, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { attachWeapons } from "./weapons";

const roster = [
  ["frostborn-jarl.glb", "SwordSlash"],
  ["frostborn-shieldmaiden.glb", "SwordSlash"],
  ["frostborn-seer.glb", "Shoot_OneHanded"],
  ["frostborn-berserker.glb", "SwordSlash"],
  ["frostborn-huscarl.glb", "SwordSlash"],
  ["frostborn-raider.glb", "SwordSlash"],
] as const;

it.each(roster)("loads %s with its rig and required clips", async (file, attack) => {
  const bytes = readFileSync(resolve("public/assets/models", file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  const bones: Bone[] = [];
  let skinnedMeshes = 0;
  gltf.scene.traverse((node) => {
    if ((node as Bone).isBone) bones.push(node as Bone);
    if ((node as SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
  });
  const clipNames = new Set(gltf.animations.map((clip) => clip.name));
  expect(skinnedMeshes).toBeGreaterThan(0);
  expect(bones.length).toBeGreaterThan(15);
  expect(bones.some((bone) => /(?:RightHand|FistR)$/.test(bone.name))).toBe(true);
  for (const name of ["Idle", "Walk", "Run", attack, "Death"]) expect(clipNames.has(name), name).toBe(true);

  if (file === "frostborn-raider.glb") {
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(gltf.scene, true);
    const height = bounds.getSize(new Vector3()).y;
    const arms = attachWeapons(gltf.scene, "p", "w", height, bounds.min.y, "viking");
    gltf.scene.updateMatrixWorld(true);
    const spear = gltf.scene.getObjectByName("weapon_spear");
    expect(arms.meshes.length).toBeGreaterThan(0);
    expect(spear?.parent?.name).toMatch(/FistR$/);
  }
});

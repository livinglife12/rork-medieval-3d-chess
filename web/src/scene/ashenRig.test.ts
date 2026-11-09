/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { AnimationMixer, Bone, Box3, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachWeapons } from './weapons';

it('loads the shipped Ashen rig and animates its skeleton with the selected walk', async () => {
  const bytes = readFileSync(resolve('public/assets/models/ashen-rig.glb'));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const bones: Bone[] = [];
  let skinnedMeshes = 0;
  gltf.scene.traverse(node => {
    if ((node as Bone).isBone) bones.push(node as Bone);
    if ((node as SkinnedMesh).isSkinnedMesh) skinnedMeshes++;
  });
  // The GLB mesh has two material primitives; Three.js creates one mesh per primitive.
  expect(skinnedMeshes).toBe(2);
  expect(bones.length).toBe(52);
  expect(bones.some(bone => /RightHand$/.test(bone.name))).toBe(true);
  for (const name of ['PARADO_ZUMB', 'Andando', 'Correndo2']) {
    const clip = gltf.animations.find(entry => entry.name === name);
    expect(clip, name).toBeDefined();
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(clip!).play();
    mixer.setTime(0);
    const before = bones.map(bone => bone.quaternion.clone());
    mixer.setTime(0.3);
    expect(bones.some((bone, i) => bone.quaternion.angleTo(before[i]) > 0.01), name).toBe(true);
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  }

  gltf.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(gltf.scene, true);
  const height = bounds.getSize(new Vector3()).y;
  const arms = attachWeapons(gltf.scene, 'p', 'w', height, bounds.min.y, 'undead');
  gltf.scene.updateMatrixWorld(true);
  const spear = gltf.scene.getObjectByName('weapon_spear');
  expect(arms.meshes.length).toBeGreaterThan(0);
  expect(spear?.parent?.name).toMatch(/RightHand$/);
  expect(spear?.getWorldPosition(new Vector3()).toArray().every(Number.isFinite)).toBe(true);
});

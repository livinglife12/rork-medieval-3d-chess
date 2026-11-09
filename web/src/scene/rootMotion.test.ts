import { Bone, Group, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { lockHorizontalRootMotion } from './rootMotion';

it('preserves world height on a rotated and scaled imported rig', () => {
  const parent = new Group();
  parent.rotation.x = -Math.PI / 2;
  parent.scale.set(2, 3, 4);
  parent.position.set(5, 6, 7);
  const root = new Bone();
  parent.add(root);
  const rest = new Vector3(1, 2, 3);
  root.position.set(4, 5, 6);
  parent.updateMatrixWorld(true);
  const height = root.getWorldPosition(new Vector3()).y;
  const anchor = parent.localToWorld(rest.clone());
  lockHorizontalRootMotion(root, rest);
  const actual = root.getWorldPosition(new Vector3());
  expect(actual.x).toBeCloseTo(anchor.x);
  expect(actual.z).toBeCloseTo(anchor.z);
  expect(actual.y).toBeCloseTo(height);
});

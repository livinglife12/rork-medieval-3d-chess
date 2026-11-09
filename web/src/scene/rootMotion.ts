import { Bone, Vector3 } from 'three';

const restWorld = new Vector3();
const animatedWorld = new Vector3();

/** Lock horizontal travel in world coordinates, preserving the animated height. */
export function lockHorizontalRootMotion(root: Bone, rest: Vector3): void {
  const parent = root.parent;
  if (!parent) {
    root.position.x = rest.x;
    root.position.z = rest.z;
    return;
  }
  parent.updateWorldMatrix(true, false);
  restWorld.copy(rest).applyMatrix4(parent.matrixWorld);
  animatedWorld.copy(root.position).applyMatrix4(parent.matrixWorld);
  animatedWorld.x = restWorld.x;
  animatedWorld.z = restWorld.z;
  root.position.copy(parent.worldToLocal(animatedWorld));
}

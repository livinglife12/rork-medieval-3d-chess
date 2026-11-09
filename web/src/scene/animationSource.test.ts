import { expect, it } from 'vitest';
import { animationSource, selectAnimation } from './animationSource';

it('selects the requested embedded animation, regardless of file order', () => {
  const reference = animationSource('/rig.glb#Zombie%20Walk');
  expect(reference.url).toBe('/rig.glb');
  expect(selectAnimation([{ name: 'Attack' }, { name: 'Zombie Walk' }], reference.clip)?.name).toBe('Zombie Walk');
  expect(selectAnimation([{ name: 'Attack' }], 'Zombie Walk')).toBeUndefined();
});

it('preserves existing single-clip files and rejects an empty selector', () => {
  expect(animationSource('/idle.glb').clip).toBeNull();
  expect(selectAnimation([{ name: 'original' }], null)?.name).toBe('original');
  expect(() => animationSource('/idle.glb#')).toThrow();
});

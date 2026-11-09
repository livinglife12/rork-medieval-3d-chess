/** A URL fragment selects an embedded clip without another network download. */
export function animationSource(reference: string): { url: string; clip: string | null } {
  const separator = reference.indexOf('#');
  if (separator < 0) return { url: reference, clip: null };
  const clip = decodeURIComponent(reference.slice(separator + 1));
  if (!clip) throw new Error('Animation selector cannot be empty');
  return { url: reference.slice(0, separator), clip };
}

export function selectAnimation<T extends { name: string }>(clips: T[], name: string | null): T | undefined {
  return name === null ? clips[0] : clips.find((clip) => clip.name === name);
}

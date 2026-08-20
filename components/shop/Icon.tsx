export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} aria-hidden="true"><use href={`#i-${name}`} /></svg>
  );
}

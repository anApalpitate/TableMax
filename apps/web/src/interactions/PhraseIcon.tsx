const paths: Record<string, string[]> = {
  hurry: ['M4 8h8M2 12h8M4 16h8', 'm13 6 7 6-7 6V6Z'],
  nice: [
    'M8 10v10H4V10h4Z',
    'M8 10l5-7c2 0 2 2 1 5h5c2 0 2 2 1 4l-2 6c0 1-1 2-3 2H8',
  ],
  carry: [
    'M12 3v15m-5-10 5-5 5 5',
    'M4 14v6h16v-6',
    'm3 6 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z',
  ],
  seventeen: ['M7 5h12v15H7z', 'M4 3h12', 'm13 8 3 4-3 4-3-4 3-4Z'],
  shameless: [
    'M12 3c6 1 9 6 7 11l-7 7-7-7C3 9 6 4 12 3Z',
    'M8 9l3 2m5-2-3 2M9 15h6',
  ],
  friendly: ['M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Z', 'm8 12 3 3 5-6'],
};
export function PhraseIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {(paths[id] ?? paths.friendly!).map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}

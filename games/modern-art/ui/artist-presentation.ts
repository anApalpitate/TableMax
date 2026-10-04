import type { ArtistId } from './view';

export const artistPresentation: Record<
  ArtistId,
  { color: string; shortName: string }
> = {
  manuel: { color: '#947000', shortName: 'Manuel' },
  sigrid: { color: '#246888', shortName: 'Sigrid' },
  daniel: { color: '#7b3f82', shortName: 'Daniel' },
  ramon: { color: '#3c7050', shortName: 'Ramon' },
  rafael: { color: '#a7531b', shortName: 'Rafael' },
};

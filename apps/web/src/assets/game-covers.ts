import { moduleFor } from '../catalog';
export const gameCover = (id: string | undefined) =>
  moduleFor(id)?.cover ?? undefined;

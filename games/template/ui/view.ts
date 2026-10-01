// UI receives projections only; never import rules or complete State here.
export type TemplateView = {
  turnSeat: string | null;
  ownSecret: number | null;
  choices: Record<string, number>;
  results: Record<string, number> | null;
  winners: string[];
};

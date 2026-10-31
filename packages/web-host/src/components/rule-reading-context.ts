import { createContext } from 'react';

export type RuleReading = {
  chapter: string;
  complete: boolean;
  scroll: number;
  expanded?: Record<string, boolean>;
};
export const RuleReadingContext = createContext<Map<
  string,
  RuleReading
> | null>(null);

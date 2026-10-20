export const EXTERNAL_PREFIXES = ['', 'http://', 'https://'] as const;
export type ExternalPrefix = (typeof EXTERNAL_PREFIXES)[number];

export function splitExternalEntry(input: string): {
  prefix: ExternalPrefix;
  value: string;
} {
  const value = input.trim();
  const match = /^(https?:\/\/)(.*)$/is.exec(value);
  return match
    ? { prefix: match[1]!.toLowerCase() as ExternalPrefix, value: match[2]! }
    : { prefix: '', value };
}

export function cycleExternalEntry(prefix: ExternalPrefix, value: string) {
  const next =
    EXTERNAL_PREFIXES[
      (EXTERNAL_PREFIXES.indexOf(prefix) + 1) % EXTERNAL_PREFIXES.length
    ]!;
  return {
    prefix: next,
    value: next ? splitExternalEntry(value).value : value,
  };
}

export function composeExternalEntry(
  prefix: ExternalPrefix,
  input: string,
): string {
  const value = input.trim();
  if (!value) return '';
  // A complete pasted address already chooses its own protocol.
  return /^https?:\/\//i.test(value) ? value : prefix + value;
}

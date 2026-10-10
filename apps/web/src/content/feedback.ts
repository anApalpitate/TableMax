import content from './feedback.zh-CN.json';

type FeedbackGroup = keyof typeof content;
export type FeedbackKey = {
  [
    Group in FeedbackGroup
  ]: `${Group}.${Extract<keyof (typeof content)[Group], string>}`;
}[FeedbackGroup];
export type FeedbackKind =
  'none' | 'saved' | 'progress' | 'connection' | 'success' | 'error';

/** Edit values in feedback.zh-CN.json; keep its group and message keys stable. */
export function feedbackText(
  key: FeedbackKey,
  parameters: Record<string, string | number> = {},
): string {
  const [group, name] = key.split('.') as [FeedbackGroup, string];
  const messages = content[group] as Record<string, string>;
  return messages[name]!.replace(/\{(\w+)\}/g, (token, parameter: string) =>
    Object.hasOwn(parameters, parameter)
      ? String(parameters[parameter])
      : token,
  );
}

export function feedbackReason(
  reason: string,
  fallback: FeedbackKey,
  group: 'sessionErrors' | 'transferErrors' = 'sessionErrors',
): string {
  const reasons: Record<string, string> = content[group];
  return Object.hasOwn(reasons, reason)
    ? reasons[reason]!
    : feedbackText(fallback);
}

const classifiedKeys: Partial<Record<FeedbackKind, readonly FeedbackKey[]>> = {
  saved: ['session.saved'],
  progress: ['admission.joining', 'session.submitting'],
  connection: [
    'session.connecting',
    'session.reconnecting',
    'session.syncFailed',
    'session.connectionFailed',
    'session.connectionUnconfirmed',
  ],
  success: ['admission.joined', 'admission.duplicateName'],
};

/** Classification follows stable keys, so editing copy does not change behavior. */
export function feedbackKind(message: string): FeedbackKind {
  if (!message) return 'none';
  for (const [kind, keys] of Object.entries(classifiedKeys)) {
    if (keys.some((key) => feedbackText(key) === message))
      return kind as FeedbackKind;
  }
  return 'error';
}

import { expect, it } from 'vitest';
import content from './feedback.zh-CN.json';
import {
  feedbackKind,
  feedbackReason,
  feedbackText,
  type FeedbackKey,
} from './feedback';

it('identifies the saved acknowledgement from the central copy', () => {
  expect(feedbackKind(feedbackText('session.saved'))).toBe('saved');
});

it('keeps admission and command progress out of short-lived notifications', () => {
  for (const key of ['admission.joining', 'session.submitting'] as const)
    expect(feedbackKind(feedbackText(key))).toBe('progress');
});

it('keeps known connection states persistent', () => {
  const keys: FeedbackKey[] = [
    'session.connecting',
    'session.reconnecting',
    'session.syncFailed',
    'session.connectionFailed',
    'session.connectionUnconfirmed',
  ];
  for (const key of keys)
    expect(feedbackKind(feedbackText(key))).toBe('connection');
});

it('shows successful admission and duplicate-name notices as success', () => {
  expect(feedbackKind(feedbackText('admission.joined'))).toBe('success');
  expect(feedbackKind(feedbackText('admission.duplicateName'))).toBe('success');
});

it('treats admission rejection and unknown replies as errors', () => {
  expect(feedbackKind(feedbackReason('room-full', 'admission.failed'))).toBe(
    'error',
  );
  expect(feedbackKind(feedbackText('session.operationFailed'))).toBe('error');
  expect(feedbackKind('unrecognized-feedback')).toBe('error');
  expect(feedbackKind('')).toBe('none');
});

it('preserves classification when a maintainer changes the wording', () => {
  const previous = content.session.saved;
  try {
    content.session.saved = '本次操作已经确认';
    expect(feedbackText('session.saved')).toBe('本次操作已经确认');
    expect(feedbackKind(feedbackText('session.saved'))).toBe('saved');
  } finally {
    content.session.saved = previous;
  }
});

it('resolves reason codes in their admission and transfer contexts', () => {
  expect(feedbackReason('session-request-conflict', 'admission.failed')).toBe(
    content.sessionErrors['session-request-conflict'],
  );
  expect(
    feedbackReason(
      'session-request-conflict',
      'transfer.failed',
      'transferErrors',
    ),
  ).toBe(content.transferErrors['session-request-conflict']);
  expect(feedbackReason('unknown-reason', 'admission.failed')).toBe(
    content.admission.failed,
  );
});

it('substitutes the game name into maintained confirmation copy', () => {
  expect(feedbackText('library.confirmSwitch', { game: 'UNO' })).toBe(
    '切换到 UNO？',
  );
  expect(feedbackText('library.confirmEndAndSwitch', { game: 'UNO' })).toBe(
    '结束当前对局，切换到 UNO？',
  );
});

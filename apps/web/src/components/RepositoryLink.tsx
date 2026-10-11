import { useEffect, type ReactNode } from 'react';
import { feedbackText } from '../content/feedback';
import { useNotifications } from './notifications/context';

export function RepositoryLink({ children }: { children: ReactNode }) {
  const notifications = useNotifications();
  useEffect(() => {
    const failed = () =>
      notifications?.show(
        feedbackText('network.repositoryOpenFailed'),
        'error',
      );
    window.addEventListener('tablemax:repository-open-error', failed);
    return () =>
      window.removeEventListener('tablemax:repository-open-error', failed);
  }, [notifications]);
  return (
    <a
      className="brand box-brand-link"
      href="https://github.com/anApalpitate/TableMax"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="TableMax 的 GitHub 仓库（在新窗口打开）"
      title="TableMax · GitHub"
      data-tablemax-repository-link=""
      onClick={(event) => {
        if (event.isTrusted && window === window.top)
          event.currentTarget.dataset.tablemaxJoinRequest = String(Date.now());
      }}
    >
      {children}
    </a>
  );
}

import { useEffect } from 'react';
import { feedbackText } from '../content/feedback';
import { useNotifications } from './notifications/context';
import './repository-link.css';

export function RepositoryLink() {
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
    <footer className="box-footer">
      <a
        className="box-repository-link"
        href="https://github.com/anApalpitate/TableMax"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="TableMax 的 GitHub 仓库（在新窗口打开）"
        title="TableMax · GitHub"
        data-tablemax-repository-link=""
        onClick={(event) => {
          if (event.isTrusted && window === window.top)
            event.currentTarget.dataset.tablemaxJoinRequest = String(
              Date.now(),
            );
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.4-1.22.72-1.5-2.5-.29-5.13-1.26-5.13-5.61 0-1.24.44-2.25 1.16-3.04-.12-.29-.5-1.44.11-3 0 0 .94-.3 3.08 1.16A10.73 10.73 0 0 1 12 6.05c.95 0 1.9.13 2.8.38 2.14-1.46 3.08-1.16 3.08-1.16.61 1.56.23 2.71.11 3 .72.79 1.16 1.8 1.16 3.04 0 4.36-2.64 5.32-5.15 5.6.41.36.77 1.04.77 2.1v3.08c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
        </svg>
      </a>
    </footer>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import './rules-guide.css';

export function RulesGuide({
  className,
  summary,
  chapters,
  source,
  initialChapter,
}: {
  className: string;
  summary: ReactNode;
  chapters: readonly {
    id: string;
    label: string;
    title: string;
    content: ReactNode;
  }[];
  source: ReactNode;
  initialChapter?: string | null;
}) {
  const label = useId();
  const navigation = useRef<HTMLElement>(null);
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  useEffect(() => {
    if (!initialChapter) return;
    const frame = requestAnimationFrame(() => {
      const heading = headings.current.get(initialChapter);
      heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
      heading?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialChapter]);
  const jump = (id: string) => {
    const heading = headings.current.get(id);
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  };
  return (
    <article className={`rules-guide ${className}`}>
      <p className="rules-guide__summary">{summary}</p>
      <nav ref={navigation} aria-label="规则章节" className="rules-guide__nav">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => jump(chapter.id)}
          >
            {chapter.label}
          </button>
        ))}
      </nav>
      <div className="rules-guide__chapters">
        {chapters.map((chapter) => (
          <section key={chapter.id} aria-labelledby={`${label}-${chapter.id}`}>
            <h3
              id={`${label}-${chapter.id}`}
              tabIndex={-1}
              ref={(element) => {
                if (element) headings.current.set(chapter.id, element);
                else headings.current.delete(chapter.id);
              }}
            >
              {chapter.title}
            </h3>
            {chapter.content}
          </section>
        ))}
      </div>
      <footer className="rules-guide__source">
        <p>{source}</p>
        <button
          type="button"
          onClick={() => {
            navigation.current?.scrollIntoView({ block: 'center' });
            navigation.current
              ?.querySelector('button')
              ?.focus({ preventScroll: true });
          }}
        >
          回到章节
        </button>
      </footer>
    </article>
  );
}

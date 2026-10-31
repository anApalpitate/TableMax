import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  useContext,
  type ReactNode,
} from 'react';
import './rules-guide.css';
import { RuleReadingContext, type RuleReading } from './rule-reading-context';

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
  const memory = useContext(RuleReadingContext);
  const previous = memory?.get(className);
  const [selectedChapter, setChapter] = useState(
    initialChapter ?? previous?.chapter ?? chapters[0]?.id ?? '',
  );
  const chapter = selectedChapter;
  const [complete, setComplete] = useState(previous?.complete ?? false);
  const article = useRef<HTMLElement>(null);
  const reading = useRef<RuleReading>({
    chapter,
    complete,
    scroll: previous?.scroll ?? 0,
    expanded: previous?.expanded ?? {},
  });
  const label = useId();
  useLayoutEffect(() => {
    const root = article.current;
    if (!root) return;
    const saved = reading.current;
    const entries = [
      ...root.querySelectorAll<HTMLElement>('[data-rule-chapter]'),
    ].flatMap((section) =>
      [...section.querySelectorAll('details')].map((element, index) => ({
        element,
        key: `${section.dataset.ruleChapter}:${index}`,
      })),
    );
    for (const { element, key } of entries) {
      if (saved.expanded?.[key] !== undefined)
        element.open = saved.expanded[key];
    }
    const rememberDetails = () => {
      saved.expanded ??= {};
      for (const { element, key } of entries)
        saved.expanded[key] = element.open;
    };
    root.addEventListener('toggle', rememberDetails, true);
    return () => {
      rememberDetails();
      root.removeEventListener('toggle', rememberDetails, true);
    };
  }, [chapter, complete]);
  useEffect(() => {
    const panel = article.current?.closest('dialog');
    if (!panel) return;
    const saved = reading.current;
    panel.scrollTop = initialChapter ? 0 : saved.scroll;
    const remember = () => {
      saved.scroll = panel.scrollTop;
      if (saved.complete) {
        const top = panel.getBoundingClientRect().top + 160;
        const current = [...headings.current]
          .filter(([, heading]) => heading.getBoundingClientRect().top <= top)
          .at(-1);
        if (current) setChapter(current[0]);
      }
    };
    panel.addEventListener('scroll', remember);
    return () => {
      panel.removeEventListener('scroll', remember);
      memory?.set(className, saved);
    };
  }, [className, memory, initialChapter]);
  useEffect(() => {
    reading.current.chapter = chapter;
    reading.current.complete = complete;
  }, [chapter, complete]);
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
    setChapter(id);
    requestAnimationFrame(() => {
      const heading = headings.current.get(id);
      heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
      heading?.focus({ preventScroll: true });
    });
  };
  return (
    <article
      ref={article}
      className={`rules-guide rules-guide--reader ${className}`}
    >
      <div className="rules-guide__tools">
        <div className="rules-guide__mobile-nav">
          <select
            aria-label="当前规则章节"
            value={chapter}
            onChange={(event) => jump(event.target.value)}
          >
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value="reference">来源与采用说明</option>
          </select>
        </div>
        <button
          className="secondary rules-guide__mode"
          type="button"
          aria-pressed={complete}
          onClick={() => {
            setComplete(!complete);
            jump(chapter);
          }}
        >
          {complete ? '分章查看' : '完整规则'}
        </button>
      </div>
      <nav ref={navigation} aria-label="规则章节" className="rules-guide__nav">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            aria-current={
              chapter.id === selectedChapter ? 'location' : undefined
            }
            onClick={() => jump(chapter.id)}
          >
            {chapter.label}
          </button>
        ))}
        <button type="button" onClick={() => jump('reference')}>
          来源与采用说明
        </button>
      </nav>
      <div className="rules-guide__chapters">
        {(complete || chapter === chapters[0]?.id) && (
          <p className="rules-guide__summary">{summary}</p>
        )}
        {chapters
          .filter((item) => complete || item.id === chapter)
          .map((chapter) => (
            <section
              key={chapter.id}
              data-rule-chapter={chapter.id}
              aria-labelledby={`${label}-${chapter.id}`}
            >
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
        {(complete || chapter === 'reference') && (
          <footer className="rules-guide__source">
            <h3
              tabIndex={-1}
              ref={(element) => {
                if (element) headings.current.set('reference', element);
                else headings.current.delete('reference');
              }}
            >
              来源与采用说明
            </h3>
            <div>{source}</div>
            <button
              type="button"
              onClick={() => {
                jump(chapters[0]?.id ?? 'reference');
              }}
            >
              回到章节
            </button>
          </footer>
        )}
      </div>
    </article>
  );
}

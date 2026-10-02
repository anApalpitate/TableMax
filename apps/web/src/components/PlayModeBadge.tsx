export function PlayModeBadge({ mode }: { mode: 'play' | 'test' | undefined }) {
  return mode === 'test' ? (
    <span className="test-mode-badge" data-mode="test" role="status">
      测试模式
    </span>
  ) : null;
}

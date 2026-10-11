export function SelectionButton({
  disabled,
  installedLabel,
  current = false,
  select,
}: {
  disabled?: boolean;
  installedLabel: string;
  current?: boolean;
  select(): void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      disabled={disabled || current}
      onClick={select}
    >
      {installedLabel}
      {current ? ' · 已选中' : ''}
    </button>
  );
}

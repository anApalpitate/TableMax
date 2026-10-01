import type { AnchorHTMLAttributes } from 'react';
import { navigate } from '../navigation';
export function ScreenLink(
  props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
) {
  return (
    <a
      {...props}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        navigate(props.href);
      }}
    />
  );
}

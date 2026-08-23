import * as React from 'react';
import '../widget/roth-conversion.js';

export interface RothConversionTheme {
  brand?: string;
  fg?: string;
  muted?: string;
  line?: string;
  edge?: string;
}

export interface RothConversionProps extends React.HTMLAttributes<HTMLDivElement> {
  credit?: boolean;
  theme?: RothConversionTheme;
  brand?: string;
  fg?: string;
  muted?: string;
  line?: string;
  edge?: string;
}

export function mount(
  root: HTMLElement,
  options?: {
    credit?: boolean;
    theme?: RothConversionTheme;
    brand?: string;
    fg?: string;
    muted?: string;
    line?: string;
    edge?: string;
  }
): () => void {
  const widget = (globalThis as unknown as { RothConversionWidget?: { mount: typeof mount } }).RothConversionWidget;
  if (widget && typeof widget.mount === 'function') {
    return widget.mount(root, options);
  }
  return () => {};
}

export const RothConversionCalculator = React.forwardRef<HTMLDivElement, RothConversionProps>(
  function RothConversionCalculator(props, ref) {
    const {
      credit = true,
      theme,
      brand,
      fg,
      muted,
      line,
      edge,
      className,
      style,
      ...rest
    } = props;

    const internalRef = React.useRef<HTMLDivElement | null>(null);

    React.useImperativeHandle(ref, () => internalRef.current as HTMLDivElement);

    const themeStyles: React.CSSProperties = {
      ...(brand ? { ['--surc-brand' as string]: brand } : {}),
      ...(fg ? { ['--surc-fg' as string]: fg } : {}),
      ...(muted ? { ['--surc-mut' as string]: muted } : {}),
      ...(line ? { ['--surc-line' as string]: line } : {}),
      ...(edge ? { ['--surc-edge' as string]: edge } : {}),
      ...(theme?.brand ? { ['--surc-brand' as string]: theme.brand } : {}),
      ...(theme?.fg ? { ['--surc-fg' as string]: theme.fg } : {}),
      ...(theme?.muted ? { ['--surc-mut' as string]: theme.muted } : {}),
      ...(theme?.line ? { ['--surc-line' as string]: theme.line } : {}),
      ...(theme?.edge ? { ['--surc-edge' as string]: theme.edge } : {}),
      ...style,
    };

    React.useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const unmount = mount(el, {
        credit,
        theme,
        brand,
        fg,
        muted,
        line,
        edge,
      });

      return () => {
        if (typeof unmount === 'function') {
          unmount();
        } else {
          el.innerHTML = '';
          el.removeAttribute('data-surc-done');
        }
      };
    }, [credit]);

    return React.createElement('div', {
      ref: internalRef,
      className,
      style: themeStyles,
      'data-stepup-roth': '',
      ...(credit === false ? { 'data-surc-credit': 'off' } : {}),
      ...rest,
    });
  }
);

export default RothConversionCalculator;

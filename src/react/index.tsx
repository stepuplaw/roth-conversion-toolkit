import React, { useEffect, useRef } from 'react';
// Import the standalone widget script so window.StepUpRoth.mount is available
// in bundled environments without external network calls.
// @ts-ignore
import '../../widget/roth-conversion.js';

declare global {
  interface Window {
    StepUpRoth?: {
      mount?: (root: HTMLElement) => () => void;
    };
  }
}

export interface RothConversionCalculatorProps {
  brand?: string;
  fg?: string;
  mut?: string;
  line?: string;
  edge?: string;
  credit?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function RothConversionCalculator(props: RothConversionCalculatorProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && rootRef.current) {
      const mount = window.StepUpRoth?.mount;
      if (mount) {
        const unmount = mount(rootRef.current);
        return () => {
          unmount?.();
        };
      }
    }
  }, []);

  const customProperties: Record<string, string> = {};
  if (props.brand !== undefined) customProperties['--surc-brand'] = props.brand;
  if (props.fg !== undefined) customProperties['--surc-fg'] = props.fg;
  if (props.mut !== undefined) customProperties['--surc-mut'] = props.mut;
  if (props.line !== undefined) customProperties['--surc-line'] = props.line;
  if (props.edge !== undefined) customProperties['--surc-edge'] = props.edge;

  const mergedStyle: React.CSSProperties = {
    ...customProperties,
    ...props.style,
  };

  return (
    <div
      ref={rootRef}
      id={props.id}
      data-stepup-roth=""
      data-surc-credit={props.credit === false ? 'off' : undefined}
      className={props.className}
      style={mergedStyle}
    />
  );
}

export default RothConversionCalculator;
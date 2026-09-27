import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import React from 'react';

// Setup browser-like global environment in Node for testing
globalThis.window = globalThis;
globalThis.document = {
  getElementById() { return null; },
  createElement() { return {}; },
  head: { appendChild() {} },
  querySelectorAll() { return []; },
};

// Setup minimal hook dispatcher so calling RothConversionCalculator does not throw in Node
const mockDispatcher = {
  useRef: (initial) => ({ current: initial }),
  useEffect: (callback) => {
    if (typeof callback === 'function') {
      const cleanup = callback();
      if (typeof cleanup === 'function') cleanup();
    }
  },
};

if (React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
  React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = mockDispatcher;
}

// Import compiled react entry point
const { RothConversionCalculator, default: DefaultExport } = await import('../dist/react/index.js');

test('React entry point can be imported and exports RothConversionCalculator', () => {
  assert.equal(typeof RothConversionCalculator, 'function');
  assert.equal(typeof DefaultExport, 'function');
  assert.equal(RothConversionCalculator, DefaultExport);
});

test('package.json exports configuration points to dist/react output', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.exports['./react'], 'package.json missing "./react" export');
  assert.equal(pkg.exports['./react'].import, './dist/react/index.js');
  assert.equal(pkg.exports['./react'].types, './dist/react/index.d.ts');
  assert.ok(pkg.peerDependencies && pkg.peerDependencies.react, 'package.json missing react peerDependency');
  assert.equal(pkg.peerDependencies.react, '>=18.0.0');

  // Verify compiled artifacts exist
  assert.ok(existsSync(new URL('../dist/react/index.js', import.meta.url)));
  assert.ok(existsSync(new URL('../dist/react/index.d.ts', import.meta.url)));
});

test('theme props map to expected CSS custom properties without modifying defaults', () => {
  const element = RothConversionCalculator({
    brand: '#1F4D3A',
    fg: '#1E293B',
    mut: '#475569',
    line: 'rgba(71,85,105,.25)',
    edge: '#334155',
    className: 'custom-card',
    id: 'calculator-instance',
    style: { margin: '20px' },
  });

  assert.equal(element.type, 'div');
  assert.equal(element.props.id, 'calculator-instance');
  assert.equal(element.props.className, 'custom-card');
  assert.equal(element.props['data-stepup-roth'], '');
  assert.equal(element.props.style['--surc-brand'], '#1F4D3A');
  assert.equal(element.props.style['--surc-fg'], '#1E293B');
  assert.equal(element.props.style['--surc-mut'], '#475569');
  assert.equal(element.props.style['--surc-line'], 'rgba(71,85,105,.25)');
  assert.equal(element.props.style['--surc-edge'], '#334155');
  assert.equal(element.props.style.margin, '20px');
});

test('omitted theme props leave custom properties unset', () => {
  const element = RothConversionCalculator({
    brand: '#00ff00',
  });

  assert.equal(element.props.style['--surc-brand'], '#00ff00');
  assert.equal(element.props.style['--surc-fg'], undefined);
  assert.equal(element.props.style['--surc-mut'], undefined);
  assert.equal(element.props.style['--surc-line'], undefined);
  assert.equal(element.props.style['--surc-edge'], undefined);
});

test('credit prop behavior: credit={false} maps to data-surc-credit="off", otherwise unset', () => {
  const offElement = RothConversionCalculator({ credit: false });
  assert.equal(offElement.props['data-surc-credit'], 'off');

  const onElement = RothConversionCalculator({ credit: true });
  assert.equal(onElement.props['data-surc-credit'], undefined);

  const defaultElement = RothConversionCalculator({});
  assert.equal(defaultElement.props['data-surc-credit'], undefined);
});

test('widget mount exposure and cleanup behavior', () => {
  assert.ok(globalThis.window, 'window object should be available after importing widget');
  assert.ok(globalThis.window.StepUpRoth, 'window.StepUpRoth should be exposed');
  assert.equal(typeof globalThis.window.StepUpRoth.mount, 'function');

  const mockInputs = ['other', 'qual', 'ss', 'exempt', 'conv', 'by', 'status', 'sp65', 'mfsapart'].map((name) => ({
    name,
    value: '',
    addEventListener() {},
    getAttribute(k) { return k === 'data-f' ? name : null; },
  }));

  const mockRoot = {
    attrs: {},
    className: '',
    innerHTML: '',
    getAttribute(k) { return this.attrs[k]; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    classList: {
      remove(c) {
        mockRoot.className = mockRoot.className.replace(c, '').trim();
      },
    },
    querySelectorAll(sel) {
      if (sel === '[data-f]') return mockInputs;
      return [];
    },
    querySelector() {
      return {
        style: {},
        innerHTML: '',
        querySelectorAll() { return []; },
      };
    },
  };

  // Calling mount sets data-surc-done and marks element
  const unmount = globalThis.window.StepUpRoth.mount(mockRoot);
  assert.equal(mockRoot.getAttribute('data-surc-done'), '1');
  assert.equal(typeof unmount, 'function');

  // Calling unmount resets data-surc-done and cleans up innerHTML
  unmount();
  assert.equal(mockRoot.getAttribute('data-surc-done'), undefined);
  assert.equal(mockRoot.innerHTML, '');
});

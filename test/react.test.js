import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToString } from 'react-dom/server';

import DefaultCalculator, {
  RothConversionCalculator,
  mount,
} from '../dist/react.js';

test('subpath exports and module interface', async () => {
  assert.equal(typeof RothConversionCalculator, 'object');
  assert.equal(DefaultCalculator, RothConversionCalculator);
  assert.equal(typeof mount, 'function');

  const pkgExport = await import('roth-conversion-toolkit/react');
  assert.equal(pkgExport.default, RothConversionCalculator);
  assert.equal(pkgExport.RothConversionCalculator, RothConversionCalculator);
  assert.equal(typeof pkgExport.mount, 'function');
});

test('package.json exports and peer dependency declaration', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.ok(pkg.exports['./react'], 'exports should have ./react entry');
  assert.equal(pkg.exports['./react'].import, './dist/react.js');
  assert.equal(pkg.exports['./react'].types, './dist/react.d.ts');

  assert.ok(!pkg.dependencies || !pkg.dependencies.react, 'React must not be a runtime dependency');
  assert.ok(pkg.peerDependencies && pkg.peerDependencies.react, 'React must be in peerDependencies');
});

test('SSR rendering of RothConversionCalculator with default props', () => {
  const html = renderToString(
    React.createElement(RothConversionCalculator, { id: 'calc-1', className: 'custom-container' })
  );
  assert.ok(html.includes('data-stepup-roth=""') || html.includes('data-stepup-roth'));
  assert.ok(html.includes('class="custom-container"'));
  assert.ok(html.includes('id="calc-1"'));
  assert.ok(!html.includes('data-surc-credit="off"'));
});

test('SSR rendering with credit={false}', () => {
  const html = renderToString(React.createElement(RothConversionCalculator, { credit: false }));
  assert.ok(html.includes('data-surc-credit="off"'));
});

test('SSR rendering with individual theme props', () => {
  const html = renderToString(
    React.createElement(RothConversionCalculator, {
      brand: '#2b5c46',
      fg: '#111827',
      muted: '#6b7280',
      line: '#e5e7eb',
      edge: '#1f2937',
    })
  );
  assert.ok(html.includes('--surc-brand:#2b5c46'));
  assert.ok(html.includes('--surc-fg:#111827'));
  assert.ok(html.includes('--surc-mut:#6b7280'));
  assert.ok(html.includes('--surc-line:#e5e7eb'));
  assert.ok(html.includes('--surc-edge:#1f2937'));
});

test('SSR rendering with theme object prop', () => {
  const html = renderToString(
    React.createElement(RothConversionCalculator, {
      theme: {
        brand: '#123456',
        fg: '#654321',
        muted: '#999999',
        line: '#cccccc',
        edge: '#000000',
      },
    })
  );
  assert.ok(html.includes('--surc-brand:#123456'));
  assert.ok(html.includes('--surc-fg:#654321'));
  assert.ok(html.includes('--surc-mut:#999999'));
  assert.ok(html.includes('--surc-line:#cccccc'));
  assert.ok(html.includes('--surc-edge:#000000'));
});

function createMockDOM() {
  const styleElements = [];
  const head = {
    appendChild(el) {
      styleElements.push(el);
      return el;
    },
  };

  const doc = {
    head,
    getElementById(id) {
      return styleElements.find((el) => el.id === id) || null;
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        id: '',
        textContent: '',
      };
    },
  };

  function createMockElement(tagName = 'DIV') {
    const attributes = new Map();
    const classListSet = new Set();
    const styleMap = new Map();
    const listeners = new Map();
    let innerHtmlContent = '';

    const el = {
      tagName: tagName.toUpperCase(),
      ownerDocument: doc,
      get className() {
        return Array.from(classListSet).join(' ');
      },
      set className(v) {
        classListSet.clear();
        String(v || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => classListSet.add(c));
      },
      classList: {
        add(c) {
          classListSet.add(c);
        },
        remove(c) {
          classListSet.delete(c);
        },
        contains(c) {
          return classListSet.has(c);
        },
      },
      style: {
        setProperty(k, v) {
          styleMap.set(k, String(v));
        },
        getPropertyValue(k) {
          return styleMap.get(k) || '';
        },
        display: '',
      },
      getAttribute(k) {
        return attributes.has(k) ? attributes.get(k) : null;
      },
      setAttribute(k, v) {
        attributes.set(k, String(v));
      },
      removeAttribute(k) {
        attributes.delete(k);
      },
      get innerHTML() {
        return innerHtmlContent;
      },
      set innerHTML(html) {
        innerHtmlContent = html;
        this._parsedElements = null;
      },
      addEventListener(event, fn, options) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push({ fn, options });
      },
      dispatchEvent(event) {
        const list = listeners.get(event.type) || [];
        for (const entry of list) {
          entry.fn(event);
        }
      },
      value: '',
      textContent: '',
      _parsedElements: null,
      _getElements() {
        if (!this._parsedElements) {
          this._parsedElements = parseMockElements(this.innerHTML, doc);
        }
        return this._parsedElements;
      },
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
      },
      querySelectorAll(selector) {
        const all = this._getElements();
        if (selector === '[data-f]') {
          return all.filter((e) => e.getAttribute('data-f') !== null);
        }
        if (selector === '[data-out="cards"]') {
          return all.filter((e) => e.getAttribute('data-out') === 'cards');
        }
        if (selector === '[data-out="agehint"]') {
          return all.filter((e) => e.getAttribute('data-out') === 'agehint');
        }
        if (selector === '[data-row="sp65"]') {
          return all.filter((e) => e.getAttribute('data-row') === 'sp65');
        }
        if (selector === '[data-row="mfsapart"]') {
          return all.filter((e) => e.getAttribute('data-row') === 'mfsapart');
        }
        return [];
      },
    };

    return el;
  }

  function parseMockElements(html, doc) {
    const list = [];
    const attrRegex = /<([a-z0-9]+)([^>]*)>/gi;
    let match;
    while ((match = attrRegex.exec(html)) !== null) {
      const tag = match[1];
      const attrStr = match[2];
      const elem = createMockElement(tag);
      const singleAttrRegex = /([a-z0-9-]+)(?:="([^"]*)")?/gi;
      let aMatch;
      while ((aMatch = singleAttrRegex.exec(attrStr)) !== null) {
        elem.setAttribute(aMatch[1], aMatch[2] !== undefined ? aMatch[2] : '');
      }
      if (elem.getAttribute('data-f') === 'status') elem.value = 'mfj';
      if (elem.getAttribute('data-f') === 'sp65') elem.value = 'no';
      if (elem.getAttribute('data-f') === 'mfsapart') elem.value = 'together';
      list.push(elem);
    }
    return list;
  }

  return { doc, createMockElement };
}

test('mount() initializes widget, injects styles, and cleans up on unmount', () => {
  const { doc, createMockElement } = createMockDOM();
  const root = createMockElement('DIV');

  const origDoc = globalThis.document;
  globalThis.document = doc;

  try {
    const unmount = mount(root, {
      brand: '#005500',
      fg: '#111111',
      credit: true,
    });

    assert.ok(doc.getElementById('surc-css'), 'Should inject surc-css stylesheet');
    assert.equal(root.style.getPropertyValue('--surc-brand'), '#005500');
    assert.equal(root.style.getPropertyValue('--surc-fg'), '#111111');
    assert.ok(root.classList.contains('surc'), 'Root should have surc class');
    assert.equal(root.getAttribute('data-surc-done'), '1');
    assert.ok(root.innerHTML.includes('Roth conversion calculator'), 'Should render calculator header');
    assert.ok(root.innerHTML.includes('stepuplaw.com'), 'Should include credit link when credit=true');

    unmount();
    assert.equal(root.innerHTML, '', 'InnerHTML should be cleared on unmount');
    assert.equal(root.getAttribute('data-surc-done'), null, 'data-surc-done should be removed');
    assert.ok(!root.classList.contains('surc'), 'surc class should be removed');
  } finally {
    globalThis.document = origDoc;
  }
});

test('mount() with credit=false suppresses credit link', () => {
  const { doc, createMockElement } = createMockDOM();
  const root = createMockElement('DIV');

  const origDoc = globalThis.document;
  globalThis.document = doc;

  try {
    const unmount = mount(root, { credit: false });
    assert.ok(!root.innerHTML.includes('stepuplaw.com</a>'), 'Credit link should be omitted when credit=false');
    unmount();
  } finally {
    globalThis.document = origDoc;
  }
});

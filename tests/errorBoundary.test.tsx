import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

test('ErrorBoundary renders children when there is no error', () => {
  const html = renderToStaticMarkup(<ErrorBoundary>safe content</ErrorBoundary>);
  assert.strictEqual(html, 'safe content');
});

function ThrowingChild(): React.ReactNode {
  throw new Error('Sensitive internal database credential exception stack at file.tsx');
}

test('ErrorBoundary catches render errors and renders a safe fallback without sensitive data', async () => {
  class FakeNode {
    nodeType = 1;
    nodeName = 'DIV';
    tagName = 'DIV';
    style: Record<string, string> = {};
    children: FakeNode[] = [];
    childNodes: any[] = [];
    ownerDocument: any = null;
    _textContent = '';

    get textContent(): string {
      if (this.nodeType === 3) return this._textContent;
      return this.childNodes.map(c => c.textContent).join('');
    }

    set textContent(val: string) {
      if (this.nodeType === 3) {
        this._textContent = val;
      } else {
        this.childNodes = [new FakeTextNode(val)];
        this.children = [];
      }
    }

    appendChild(c: any) {
      this.childNodes.push(c);
      if (c.nodeType === 1) this.children.push(c);
      return c;
    }

    removeChild(c: any) {
      const idx = this.childNodes.indexOf(c);
      if (idx >= 0) this.childNodes.splice(idx, 1);
      const cidx = this.children.indexOf(c);
      if (cidx >= 0) this.children.splice(cidx, 1);
      return c;
    }

    insertBefore(c: any, ref: any) {
      const idx = this.childNodes.indexOf(ref);
      if (idx >= 0) {
        this.childNodes.splice(idx, 0, c);
        if (c.nodeType === 1) this.children.push(c);
      } else {
        this.appendChild(c);
      }
      return c;
    }

    setAttribute() {}
    removeAttribute() {}
    addEventListener() {}
    removeEventListener() {}

    get outerHTML(): string {
      if (this.nodeType === 3) return this._textContent;
      const tag = this.tagName.toLowerCase();
      const inner = this.childNodes.map(c => c.outerHTML).join('');
      return `<${tag}>${inner}</${tag}>`;
    }
  }

  class FakeTextNode extends FakeNode {
    constructor(text: string) {
      super();
      this.nodeType = 3;
      this.nodeName = '#text';
      this._textContent = text;
    }
  }

  class FakeEvent {
    type: string;
    target: any;
    srcElement: any;
    currentTarget: any;
    bubbles = false;
    cancelable = false;
    defaultPrevented = false;
    eventPhase = 0;
    isTrusted = true;
    timeStamp = Date.now();
    constructor(type: string) {
      this.type = type;
    }
    preventDefault() {}
    stopPropagation() {}
    stopImmediatePropagation() {}
  }

  class FakeErrorEvent extends FakeEvent {
    error: any;
    message: string;
    constructor(type: string, init: any = {}) {
      super(type);
      this.error = init.error;
      this.message = init.message || '';
    }
  }

  const doc: any = {
    nodeType: 9,
    nodeName: '#document',
    ownerDocument: null,
    createElement: (tag: string) => {
      const el = new FakeNode();
      el.nodeName = tag.toUpperCase();
      el.tagName = tag.toUpperCase();
      el.ownerDocument = doc;
      return el;
    },
    createComment: () => new FakeNode(),
    createTextNode: (text: string) => new FakeTextNode(text),
    createEvent: () => new FakeEvent('custom'),
    addEventListener: () => {},
    removeEventListener: () => {},
    HTMLIFrameElement: class HTMLIFrameElement {},
    HTMLElement: FakeNode,
    Element: FakeNode,
  };

  const win: any = globalThis;
  doc.defaultView = win;
  doc.documentElement = doc.createElement('html');
  doc.body = doc.createElement('body');
  doc.head = doc.createElement('head');
  doc.activeElement = doc.body;

  const fakeEvt = new FakeEvent('none');
  fakeEvt.target = doc.body;
  fakeEvt.srcElement = doc.body;
  fakeEvt.currentTarget = doc.body;

  win.document = doc;
  win.window = win;
  win.Event = FakeEvent;
  win.CustomEvent = FakeEvent;
  win.ErrorEvent = FakeErrorEvent;
  win.dispatchEvent = () => true;
  win.event = fakeEvt;
  win.HTMLIFrameElement = doc.HTMLIFrameElement;
  win.HTMLElement = FakeNode;
  win.Element = FakeNode;

  const { createRoot } = await import('react-dom/client');
  const { flushSync } = await import('react-dom');

  const container = doc.createElement('div');
  const root = createRoot(container);

  const origConsoleError = console.error;
  console.error = () => {};

  try {
    flushSync(() => {
      root.render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      );
    });
  } finally {
    console.error = origConsoleError;
  }

  const html = container.outerHTML;

  assert.ok(html.includes('Something went wrong.'));
  assert.ok(html.includes('Reload'));
  assert.ok(!html.includes('Sensitive'));
  assert.ok(!html.includes('Error:'));
  assert.ok(!html.includes('at '));
  assert.ok(!html.includes('.tsx'));
  assert.ok(!html.includes('firebase'));
  assert.ok(!html.includes('google'));

  flushSync(() => {
    root.unmount();
  });
});
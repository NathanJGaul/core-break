import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from 'svelte/compiler';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

class TestNode {
  constructor(ownerDocument, nodeType, data = '') {
    this.ownerDocument = ownerDocument;
    this.nodeType = nodeType;
    this.data = data;
    this.parentNode = null;
    this.childNodes = [];
  }

  appendChild(node) {
    if (node.nodeType === 11) {
      while (node.firstChild) this.appendChild(node.firstChild);
      return node;
    }
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  insertBefore(node, anchor) {
    if (node.nodeType === 11) {
      while (node.firstChild) this.insertBefore(node.firstChild, anchor);
      return node;
    }
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    const index = anchor ? this.childNodes.indexOf(anchor) : -1;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  replaceChild(next, previous) {
    const index = this.childNodes.indexOf(previous);
    if (index >= 0) {
      previous.parentNode = null;
      next.parentNode = this;
      this.childNodes[index] = next;
    }
    return previous;
  }

  hasChildNodes() { return this.childNodes.length > 0; }
  contains(node) { return node === this || this.childNodes.some((child) => child === node || child.contains?.(node)); }
  remove() { this.parentNode?.removeChild(this); }
  dispatchEvent(event) {
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get textContent() {
    return this.nodeType === 3 || this.nodeType === 8
      ? this.data
      : this.childNodes.map((child) => child.textContent).join('');
  }

  get nodeValue() { return this.data; }
  set nodeValue(value) { this.data = String(value); }

  set textContent(value) {
    this.childNodes = [];
    if (value) this.appendChild(this.ownerDocument.createTextNode(String(value)));
  }

  cloneNode(deep = false) {
    const clone = new TestNode(this.ownerDocument, this.nodeType, this.data);
    if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
    return clone;
  }
}

class TestEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.bubbles = false; }
}

class TestElement extends TestNode {
  constructor(ownerDocument, tagName) {
    super(ownerDocument, 1);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = {
      add: (...names) => this.setAttribute('class', `${this.className} ${names.join(' ')}`.trim()),
      remove: (...names) => this.setAttribute('class', this.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(' ')),
      contains: (name) => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const present = this.classList.contains(name);
        const next = force === undefined ? !present : Boolean(force);
        if (next && !present) this.classList.add(name);
        if (!next && present) this.classList.remove(name);
        return next;
      }
    };
  }

  setAttribute(name, value = '') {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'value') this.value = String(value);
    if (name === 'checked') this.checked = true;
    if (name === 'disabled') this.disabled = true;
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'checked') this.checked = false;
    if (name === 'disabled') this.disabled = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener));
  }

  dispatchEvent(event) {
    event.target ??= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  click() { return this.dispatchEvent(new TestEvent('click', { bubbles: true })); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  get innerHTML() { return this.childNodes.map((child) => child.textContent).join(''); }
  set innerHTML(value) {
    this.childNodes = [];
    parseHTML(String(value), this.ownerDocument, this);
  }

  matches(selector) {
    const attribute = selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);
    if (attribute) return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (child.matches(selector)) result.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return result;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  cloneNode(deep = false) {
    const clone = new TestElement(this.ownerDocument, this.tagName);
    for (const [name, value] of this.attributes) clone.setAttribute(name, value);
    for (const property of ['value', 'checked', 'disabled', 'type']) clone[property] = this[property];
    if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
    return clone;
  }
}

class TestTemplate extends TestElement {
  constructor(ownerDocument) {
    super(ownerDocument, 'template');
    this.content = new TestNode(ownerDocument, 11);
  }

  set innerHTML(value) {
    this.content.childNodes = [];
    parseHTML(String(value), this.ownerDocument, this.content);
  }

  get innerHTML() { return this.content.childNodes.map((child) => child.textContent).join(''); }
  get firstChild() { return this.content.firstChild; }
  cloneNode(deep = false) {
    const clone = new TestTemplate(this.ownerDocument);
    if (deep) for (const child of this.content.childNodes) clone.content.appendChild(child.cloneNode(true));
    return clone;
  }
}

function parseHTML(html, document, parent) {
  const stack = [parent];
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<!')) {
      stack.at(-1).appendChild(document.createComment(token));
      continue;
    }
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1).appendChild(document.createTextNode(token));
      continue;
    }
    const match = token.match(/^<\s*([A-Za-z][\w:-]*)\s*([\s\S]*?)(?:\/\s*)?>$/);
    if (!match) continue;
    const element = document.createElement(match[1]);
    const attributes = match[2];
    const attributeRe = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attribute;
    while ((attribute = attributeRe.exec(attributes))) element.setAttribute(attribute[1], attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
    stack.at(-1).appendChild(element);
    if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(element.tagName) && !/\/\s*>$/.test(token)) stack.push(element);
  }
}

class TestDocument extends TestNode {
  constructor() {
    super(null, 9);
    this.ownerDocument = this;
    this.documentElement = new TestElement(this, 'html');
    this.head = new TestElement(this, 'head');
    this.body = new TestElement(this, 'body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.activeElement = null;
    this.visibilityState = 'visible';
  }

  createElement(tagName) { return tagName.toLowerCase() === 'template' ? new TestTemplate(this) : new TestElement(this, tagName); }
  createElementNS(_namespace, tagName) { return this.createElement(tagName); }
  createTextNode(data) { return new TestNode(this, 3, String(data)); }
  createComment(data) { return new TestNode(this, 8, String(data)); }
  createDocumentFragment() { return new TestNode(this, 11); }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
  querySelector(selector) { return this.documentElement.querySelector(selector); }
  addEventListener() {}
  removeEventListener() {}
}

function installDom() {
  const document = new TestDocument();
  const window = {
    document,
    location: { origin: 'https://example.test', pathname: '/' },
    navigator: { onLine: true },
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {}
  };
  globalThis.window = window;
  globalThis.document = document;
  globalThis.location = window.location;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: window.navigator });
  globalThis.Node = TestNode;
  globalThis.Element = TestElement;
  globalThis.HTMLElement = TestElement;
  globalThis.SVGElement = TestElement;
  globalThis.DocumentFragment = TestNode;
  globalThis.Event = TestEvent;
  globalThis.CustomEvent = TestEvent;
  globalThis.$state = (value) => value;
  globalThis.$state.snapshot = (value) => structuredClone(value);
  globalThis.localStorage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, String(value)); },
    removeItem(key) { this.values.delete(key); }
  };
  return document;
}

function textOf(node) { return node.textContent.replace(/\s+/g, ' ').trim(); }
function button(target, text) { return target.querySelectorAll('button').find((entry) => textOf(entry).includes(text)); }
function input(target, label) { return target.querySelectorAll('input').find((entry) => entry.getAttribute('aria-label') === label || entry.getAttribute('id') === label); }
function inputValue(element, value) {
  element.value = value;
  element.dispatchEvent(new TestEvent('input', { bubbles: true }));
}
function flush() { return new Promise((resolve) => setTimeout(resolve, 0)); }

const document = installDom();
const { mount, unmount, tick } = await import('svelte');
const root = resolve(process.cwd());
const generated = await mkdtemp(resolve(root, 'tests/.ui-generated-'));
const { app, sync, setSyncCode, syncNow } = await import('../src/lib/store.svelte.js');
const { emptyState } = await import('../src/lib/merge.js');

after(() => rm(generated, { recursive: true, force: true }));

async function component(name, sourcePath) {
  const source = await readFile(sourcePath, 'utf8');
  let code = compile(source, { filename: sourcePath, generate: 'client' }).js.code;
  const imports = name === 'Settings'
    ? [['../lib/store.svelte.js', '../src/lib/store.svelte.js'], ['../lib/audio.js', '../src/lib/audio.js']]
    : [['../lib/store.svelte.js', '../src/lib/store.svelte.js'], ['../lib/program.js', '../src/lib/program.js']];
  for (const [from, to] of imports) code = code.replaceAll(`'${from}'`, `'${pathToFileURL(resolve(root, to)).href}'`);
  const target = resolve(generated, `${name}.js`);
  await writeFile(target, code);
  return (await import(`${pathToFileURL(target).href}?${Date.now()}`)).default;
}

const Settings = await component('Settings', resolve(root, 'src/views/Settings.svelte'));
const Onboarding = await component('Onboarding', resolve(root, 'src/views/Onboarding.svelte'));

afterEach(() => {
  document.body.childNodes = [];
  app.data = emptyState();
  sync.code = null;
  sync.status = 'idle';
  sync.message = '';
  sync.errorCode = '';
  sync.storageError = false;
});

function mounted(Component, props = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const instance = mount(Component, { target, props });
  return { target, instance };
}

test('onboarding drives connect and renders revoked and storage failure states', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ state: emptyState(), revision: 1 }), { status: 200 });
  const { target, instance } = mounted(Onboarding, { onbaseline() {} });
  button(target, 'Already using Core Break').click();
  const code = 'C'.repeat(32);
  inputValue(input(target, 'join-code'), code);
  button(target, 'Connect').click();
  await syncNow();
  assert.equal(sync.code, code);

  sync.status = 'revoked';
  sync.message = 'This sync code was revoked.';
  await tick();
  assert.match(textOf(target), /This sync code was revoked/);

  sync.status = 'idle';
  sync.message = '';
  sync.storageError = true;
  await tick();
  assert.match(textOf(target), /Device storage is unavailable/);
  unmount(instance);
});

test('settings drives connect and exposes sync lifecycle confirmations and failures', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ state: emptyState(), revision: 1 }), { status: 200 });
  const first = mounted(Settings);
  assert.match(textOf(first.target), /Sync is off/);
  inputValue(input(first.target, 'Existing sync code'), 'D'.repeat(32));
  button(first.target, 'Connect').click();
  await syncNow();
  assert.equal(sync.code, 'D'.repeat(32));
  unmount(first.instance);

  const active = mounted(Settings);
  sync.status = 'revoked';
  sync.message = 'This sync code was revoked.';
  await tick();
  assert.match(textOf(active.target), /This sync code was revoked/);

  button(active.target, 'Rotate shared code').click();
  await tick();
  assert.match(textOf(active.target), /Rotate the shared code/);
  button(active.target, 'Cancel').click();
  await tick();

  button(active.target, 'Delete synced data').click();
  await tick();
  assert.match(textOf(active.target), /Delete all synced data from the server/);
  button(active.target, 'Cancel').click();
  await tick();

  sync.status = 'error';
  sync.message = '';
  sync.storageError = true;
  await tick();
  assert.match(textOf(active.target), /Device storage is unavailable/);
  unmount(active.instance);
  setSyncCode(null);
  await flush();
});

// S1 étape 2 · Faux DOM minimal, zéro dépendance (ADR-001), qui permet
// d'importer et de piloter js/ui.js sous node. ui.js touche le DOM au
// chargement du module (`const root = document.getElementById('app')`,
// ui.js:22) : installTinyDom() installe les globales AVANT l'import
// dynamique, ce qui contourne cet obstacle sans toucher au fichier de
// production. Suffisant pour les écrans exercés par le filet (live, chevet),
// pas une implémentation générale du DOM.

let idSeq = 0;

class TinyNode {
  constructor(nodeType) {
    this.nodeType = nodeType; // 1 = élément, 3 = texte
    this.parentNode = null;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  replaceWith(...nodes) {
    const parent = this.parentNode;
    if (!parent) return;
    const idx = parent.children.indexOf(this);
    if (idx === -1) return;
    parent.children.splice(idx, 1, ...nodes);
    for (const n of nodes) n.parentNode = parent;
    this.parentNode = null;
  }
}

class TinyText extends TinyNode {
  constructor(text) {
    super(3);
    this.textContent = String(text);
  }
}

class TinyElement extends TinyNode {
  constructor(tag) {
    super(1);
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._attrs = new Map();
    this._listeners = new Map();
    this.classList = {
      _set: new Set(),
      add: (...cls) => cls.forEach((c) => this.classList._set.add(c)),
      remove: (...cls) => cls.forEach((c) => this.classList._set.delete(c)),
      toggle: (c, force) => {
        const has = this.classList._set.has(c);
        const on = force === undefined ? !has : force;
        if (on) this.classList._set.add(c); else this.classList._set.delete(c);
        return on;
      },
      contains: (c) => this.classList._set.has(c),
    };
    this.style = {
      setProperty: (prop, val) => { this.style[prop] = val; },
      removeProperty: (prop) => { delete this.style[prop]; },
    };
    this.dataset = {};
    this.value = '';
    this.checked = false;
    this._html = '';
  }

  get id() { return this._attrs.get('id') || ''; }
  set id(v) { this.setAttribute('id', v); }

  get className() { return [...this.classList._set].join(' '); }
  set className(v) {
    this.classList._set.clear();
    String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList._set.add(c));
  }

  get textContent() {
    return this.children.map((c) => (c.nodeType === 3 ? c.textContent : c.textContent)).join('');
  }
  set textContent(v) {
    this.children = [];
    if (v !== '' && v != null) {
      const t = new TinyText(v);
      t.parentNode = this;
      this.children.push(t);
    }
  }

  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children = []; }

  setAttribute(name, value) { this._attrs.set(name, String(value)); }
  getAttribute(name) { return this._attrs.has(name) ? this._attrs.get(name) : null; }
  hasAttribute(name) { return this._attrs.has(name); }
  removeAttribute(name) { this._attrs.delete(name); }

  appendChild(node) {
    this.children.push(node);
    node.parentNode = this;
    return node;
  }
  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx !== -1) { this.children.splice(idx, 1); node.parentNode = null; }
    return node;
  }
  replaceChildren(...nodes) {
    for (const c of this.children) c.parentNode = null;
    this.children = nodes;
    for (const n of nodes) n.parentNode = this;
  }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    event.currentTarget = this;
    for (const fn of this._listeners.get(event.type) || []) fn(event);
    return true;
  }

  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 120, bottom: 40, width: 120, height: 40 }; }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = null; }
  select() {}

  querySelector(selector) { return querySelectorIn(this, selector); }
  querySelectorAll(selector) { return querySelectorAllIn(this, selector); }
}

function matches(node, selector) {
  if (node.nodeType !== 1) return false;
  if (selector.startsWith('#')) return node.getAttribute('id') === selector.slice(1);
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

function walk(node, fn) {
  for (const c of node.children || []) {
    fn(c);
    walk(c, fn);
  }
}

function querySelectorIn(root, selector) {
  let found = null;
  walk(root, (n) => { if (!found && matches(n, selector)) found = n; });
  return found;
}
function querySelectorAllIn(root, selector) {
  const out = [];
  walk(root, (n) => { if (matches(n, selector)) out.push(n); });
  return out;
}

// Concatène récursivement tout le texte visible sous un nœud (traverse les
// éléments, additionne le textContent des feuilles). Utile pour vérifier
// qu'aucune chaîne interdite n'apparaît nulle part dans un écran rendu.
export function allText(root) {
  const parts = [];
  if (root.nodeType === 3) return root.textContent;
  for (const c of root.children || []) parts.push(allText(c));
  return parts.join(' ');
}

// Premier nœud dont le textContent EXACT correspond, ou dont le predicate
// renvoie vrai. Cherche l'élément lui-même puis descend.
export function findWhere(root, predicate) {
  let found = null;
  (function step(n) {
    if (found) return;
    if (n.nodeType === 1 && predicate(n)) { found = n; return; }
    for (const c of n.children || []) step(c);
  })(root);
  return found;
}
export function findAllWhere(root, predicate) {
  const out = [];
  (function step(n) {
    if (n.nodeType === 1 && predicate(n)) out.push(n);
    for (const c of n.children || []) step(c);
  })(root);
  return out;
}
export function byClass(root, cls) {
  return findWhere(root, (n) => n.classList.contains(cls));
}
export function byExactText(root, text) {
  return findWhere(root, (n) => n.textContent === text);
}

function makeFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    _store: store,
  };
}

// Installe un DOM et des globales fraîches. À appeler avant chaque import
// dynamique de ui.js (avec un suffixe de requête unique) pour repartir d'un
// état propre : ui.js garde son état de session (`live`, `night`,
// `currentScreen`) dans des variables de module, remises à zéro uniquement
// par une nouvelle instance du module.
export function installTinyDom() {
  const documentElement = new TinyElement('html');
  const body = new TinyElement('body');
  const app = new TinyElement('div');
  app.setAttribute('id', 'app');
  documentElement.appendChild(body);
  body.appendChild(app);

  const listeners = new Map();
  const document_ = {
    documentElement,
    body,
    hidden: false,
    visibilityState: 'visible',
    activeElement: null,
    createElement: (tag) => { const el = new TinyElement(tag); el.ownerDocument = document_; return el; },
    createElementNS: (_ns, tag) => { const el = new TinyElement(tag); el.ownerDocument = document_; return el; },
    createTextNode: (text) => new TinyText(text),
    getElementById: (id) => querySelectorIn(documentElement, '#' + id),
    querySelector: (sel) => querySelectorIn(documentElement, sel),
    querySelectorAll: (sel) => querySelectorAllIn(documentElement, sel),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => { listeners.get(type)?.delete(fn); },
    dispatchEvent: (event) => {
      event.target = document_;
      for (const fn of listeners.get(event.type) || []) fn(event);
      return true;
    },
  };

  const fakeLocalStorage = makeFakeLocalStorage();

  Object.defineProperty(globalThis, 'document', { value: document_, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: fakeLocalStorage, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.window = globalThis;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  // Plausible mais inerte : aucun test ne dépend de sa valeur exacte, seule
  // sa présence compte (ex. settings.js construit une URL de raccourci).
  Object.defineProperty(globalThis, 'location', {
    value: { origin: 'https://douce-heure.invalid', pathname: '/', search: '', href: 'https://douce-heure.invalid/' },
    configurable: true,
  });

  return {
    document: document_,
    app,
    localStorage: fakeLocalStorage,
    // Simule un événement DOM sur un nœud, avec des valeurs par défaut
    // plausibles (pointerId, preventDefault, clientX/Y) que les tests
    // peuvent surcharger.
    fireEvent(node, type, props = {}) {
      const event = {
        type,
        pointerId: 1,
        clientX: 20,
        clientY: 20,
        key: undefined,
        repeat: false,
        preventDefault() {},
        ...props,
      };
      node.dispatchEvent(event);
      return event;
    },
  };
}

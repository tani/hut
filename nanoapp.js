export const Fragment = Symbol('Fragment');
export const metadata = new WeakMap();
export const formProps = ['value', 'checked', 'selected'];

export function jsx(type, props, key) {
  props ??= {};

  if (typeof type === 'function') {
    const result = type(props);
    if (key == null) return result;
    if (!(result instanceof Element)) {
      throw new TypeError('Keyed components must return one element');
    }
    metadata.set(result, { events: new Map(), props: {}, ...metadata.get(result), key });
    return result;
  }

  if (type !== Fragment && typeof type !== 'string') {
    throw new TypeError('Invalid JSX type');
  }

  const element = type === Fragment
    ? document.createDocumentFragment()
    : document.createElement(type);

  for (const child of [props.children].flat(Infinity)) {
    if (child instanceof Node) element.append(child);
    else if (child != null && typeof child !== 'boolean') element.append(String(child));
  }
  if (type === Fragment) return element;

  const events = new Map();
  for (const [name, value] of Object.entries(props)) {
    if (name === 'children' || name === 'key' || formProps.includes(name)) continue;

    if (name.startsWith('on') && typeof value === 'function') {
      const event = name.slice(2).toLowerCase();
      events.set(event, value);
      element.addEventListener(event, value);
    } else if (name === 'style' && value && typeof value === 'object') {
      for (const [property, entry] of Object.entries(value)) {
        if (property.includes('-')) element.style.setProperty(property, String(entry));
        else Reflect.set(element.style, property, String(entry));
      }
    } else if (value != null && value !== false) {
      const attribute = name === 'className' ? 'class' : name === 'htmlFor' ? 'for' : name;
      element.setAttribute(attribute, value === true ? '' : String(value));
    }
  }

  for (const name of formProps) {
    if (name in props && name in element) Reflect.set(element, name, props[name]);
  }
  metadata.set(element, { key: key ?? props.key, events, props });
  return element;
}

export const jsxs = jsx;
export const jsxDEV = jsx;

function observable(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
}

export function reactive(initial, notify) {
  if (!observable(initial)) throw new TypeError('State must be a plain object or array');

  const proxies = new WeakMap();
  const originals = new WeakMap();

  function wrap(value) {
    if (!observable(value) || originals.has(value)) return value;
    if (proxies.has(value)) return proxies.get(value);

    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        return wrap(Reflect.get(target, key, receiver));
      },
      set(target, key, value, receiver) {
        const had = Object.hasOwn(target, key);
        const before = Reflect.get(target, key, receiver);
        const raw = originals.get(value) ?? value;
        const ok = Reflect.set(target, key, raw, receiver);
        if (ok && (!had || !Object.is(before, Reflect.get(target, key, receiver)))) {
          notify();
        }
        return ok;
      },
      deleteProperty(target, key) {
        const had = Object.hasOwn(target, key);
        const ok = Reflect.deleteProperty(target, key);
        if (ok && had) notify();
        return ok;
      },
    });

    proxies.set(value, proxy);
    originals.set(proxy, value);
    return proxy;
  }

  return wrap(initial);
}

const keyOf = node => metadata.get(node)?.key;

function compatible(a, b) {
  return a.nodeType === b.nodeType
    && a.nodeName === b.nodeName
    && (!(a instanceof Element) || (b instanceof Element && a.namespaceURI === b.namespaceURI))
    && keyOf(a) === keyOf(b);
}

export function morph(oldNode, nextNode) {
  if (!compatible(oldNode, nextNode)) {
    oldNode.parentNode?.replaceChild(nextNode, oldNode);
    return nextNode;
  }

  if (!(oldNode instanceof Element) || !(nextNode instanceof Element)) {
    if (oldNode.nodeValue !== nextNode.nodeValue) oldNode.nodeValue = nextNode.nodeValue;
    return oldNode;
  }

  for (const { name } of [...oldNode.attributes]) {
    if (!nextNode.hasAttribute(name)) oldNode.removeAttribute(name);
  }
  for (const { name, value } of [...nextNode.attributes]) {
    if (oldNode.getAttribute(name) !== value) oldNode.setAttribute(name, value);
  }

  const before = metadata.get(oldNode);
  const after = metadata.get(nextNode);
  for (const [name, listener] of before?.events ?? []) {
    if (after?.events.get(name) !== listener) oldNode.removeEventListener(name, listener);
  }
  for (const [name, listener] of after?.events ?? []) {
    if (before?.events.get(name) !== listener) oldNode.addEventListener(name, listener);
  }
  if (after) metadata.set(oldNode, after);
  else metadata.delete(oldNode);

  morphChildren(oldNode, nextNode);
  for (const name of formProps) {
    if (after && name in after.props && name in oldNode && oldNode[name] !== nextNode[name]) {
      Reflect.set(oldNode, name, nextNode[name]);
    }
  }
  return oldNode;
}

export function morphChildren(parent, target) {
  const previous = [...parent.childNodes];
  const desired = [...target.childNodes];
  const keyed = new Map(
    previous.filter(node => keyOf(node) != null).map(node => [keyOf(node), node])
  );
  const keys = desired.map(keyOf).filter(key => key != null);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate sibling key');

  const unkeyed = previous.filter(node => keyOf(node) == null).values();
  let cursor = parent.firstChild;

  for (const node of desired) {
    const key = keyOf(node);
    const candidate = key == null ? unkeyed.next().value : keyed.get(key);
    const chosen = candidate && compatible(candidate, node) ? morph(candidate, node) : node;

    if (chosen !== cursor) {
      if (chosen.parentNode === parent && parent.moveBefore) {
        parent.moveBefore(chosen, cursor);
      } else {
        parent.insertBefore(chosen, cursor);
      }
    }
    cursor = chosen.nextSibling;
  }

  // Everything before the cursor is already in the desired order.
  while (cursor) {
    const next = cursor.nextSibling;
    cursor.remove();
    cursor = next;
  }
}

export function mount(root, app, initial = {}) {
  let active = true;
  let pending = false;
  let rendered;
  let render = app;
  let stopRouting;
  const state = reactive(initial, schedule);

  if (typeof app !== 'function') {
    const window = root.ownerDocument.defaultView;
    const readPath = () => window.location.hash.slice(1).split('?', 1)[0] || '/';
    let path = readPath();
    const view = hashView(app);
    render = props => view({ ...props, path });

    const sync = () => {
      const next = readPath();
      if (next === path) return;
      path = next;
      schedule();
    };

    window.addEventListener('hashchange', sync);
    stopRouting = () => window.removeEventListener('hashchange', sync);
  }

  function schedule() {
    if (!active || pending) return;
    pending = true;

    rendered = Promise.resolve().then(() => {
      pending = false;
      if (!active) return;

      const next = jsx(Fragment, { children: render({ state }) });
      morphChildren(root, next);
    });
  }

  schedule();
  return {
    state,
    get rendered() { return rendered; },
    unmount() {
      if (!active) return;
      active = false;
      stopRouting?.();
      root.replaceChildren();
    },
  };
}

function hashView({ routes, notFound = () => null }) {
  const patterns = Object.entries(routes).map(([path, view]) => [path.split('/'), view]);

  return ({ path, state }) => {
    let segments;
    try {
      segments = path.split('/').map(decodeURIComponent);
    } catch {
      return notFound({ path, params: {}, state });
    }

    for (const [pattern, view] of patterns) {
      if (pattern.length !== segments.length) continue;

      const params = [];
      const matches = pattern.every((part, index) => {
        if (!part.startsWith(':')) return part === segments[index];
        if (!segments[index]) return false;
        params.push([part.slice(1), segments[index]]);
        return true;
      });

      if (matches) return view({ path, params: Object.fromEntries(params), state });
    }

    return notFound({ path, params: {}, state });
  };
}

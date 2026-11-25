/**
 * @file Render JSX to DOM with synchronous components and reactive state.
 * Configure the automatic JSX transform with `jsxImportSource: "nova-jsx"`.
 * In TypeScript, set `jsx: "react-jsx"` for this transform.
 *
 * @example
 * ```tsx
 * import { mount } from "nova-jsx";
 *
 * const root = document.querySelector("main");
 * if (!root) throw new Error("Missing mount point");
 *
 * mount(
 *   root,
 *   ({ state }) => <button onClick={() => state.count++}>Count: {state.count}</button>,
 *   { count: 0 },
 * );
 * ```
 */

/** Groups children in a document fragment without adding a wrapper element. */
export const Fragment = Symbol("Fragment");
/** @typedef {string | number | bigint | boolean | symbol | Node | null | undefined | readonly Child[]} Child */
/** @typedef {Record<string, unknown> & { children?: Child }} Props */
/** @typedef {{ key: unknown, events: Map<string, EventListener>, props: Props }} ElementMetadata */

/**
 * Stores keys, listeners, and props for nodes created by JSX. The reconciler
 * reads this map when updating existing nodes.
 * @type {WeakMap<Node, ElementMetadata>}
 */
export const metadata = new WeakMap();
/** Form properties that JSX sets on DOM objects and reapplies after reconciliation. */
export const formProps = ["value", "checked", "selected"];

/**
 * The JSX transform calls this function to create an element, invoke a
 * synchronous component, or create a fragment.
 * Nested child arrays are flattened. Nullish values and booleans are skipped.
 * Use `onClick` for events, `className` for CSS classes, and an object for styles.
 * Use stable, unique keys among siblings to preserve node identity when reordering.
 * A keyed component must return one element. Promises and thenables are unsupported.
 *
 * @example
 * ```tsx
 * const items = [{ id: "ada", label: "Ada" }, { id: "lin", label: "Lin" }];
 * const list = <ul>{items.map(({ id, label }) => <li key={id}>{label}</li>)}</ul>;
 * ```
 *
 * @example
 * ```tsx
 * function Label({ name }: { name: string }) {
 *   return <strong>{name}</strong>;
 * }
 * const content = <>Hello, <Label name="Ada" /></>;
 * ```
 *
 * @template {Props} P
 * @param {string | typeof Fragment | ((props: P) => Child)} type
 * @param {P | null} [props]
 * @param {unknown} [key]
 */
export function jsx(type, props, key) {
  props ??= /** @type {P} */ ({});

  if (typeof type === "function") {
    const result = type(props);
    if (key == null) return result;
    if (!(result instanceof Element)) {
      throw new TypeError("Keyed components must return one element");
    }
    metadata.set(result, { events: new Map(), props: {}, ...metadata.get(result), key });
    return result;
  }

  if (type === Fragment) return appendChildren(document.createDocumentFragment(), props.children);

  const element = appendChildren(document.createElement(type), props.children);

  /** @type {Map<string, EventListener>} */
  const events = new Map();
  for (const [name, value] of Object.entries(/** @type {Props} */ (props))) {
    if (name === "children" || name === "key" || formProps.includes(name)) continue;

    if (name.startsWith("on") && typeof value === "function") {
      const event = name.slice(2).toLowerCase();
      const listener = /** @type {EventListener} */ (value);
      events.set(event, listener);
      element.addEventListener(event, listener);
    } else if (name === "style" && value && typeof value === "object") {
      for (const [property, entry] of Object.entries(value)) {
        if (property.includes("-")) element.style.setProperty(property, String(entry));
        else Reflect.set(element.style, property, String(entry));
      }
    } else if (value != null && value !== false) {
      const attribute = name === "className" ? "class" : name === "htmlFor" ? "for" : name;
      // oxlint-disable-next-line typescript/no-base-to-string -- Preserve JSX attribute coercion.
      element.setAttribute(attribute, value === true ? "" : String(value));
    }
  }

  for (const name of formProps) {
    if (name in props && name in element) Reflect.set(element, name, props[name]);
  }
  metadata.set(element, { key: key ?? props.key, events, props });
  return element;
}

/**
 * @template {HTMLElement | DocumentFragment} Parent
 * @param {Parent} parent
 * @param {unknown} children
 */
function appendChildren(parent, children) {
  for (const child of [children].flat(Infinity)) {
    if (child instanceof Node) parent.append(child);
    else if (child != null && typeof child !== "boolean") {
      // oxlint-disable-next-line typescript/no-base-to-string -- Preserve JSX child coercion.
      parent.append(String(child));
    }
  }
  return parent;
}

/** JSX runtime alias for elements with multiple children. */
export const jsxs = jsx;
/** JSX development runtime alias. */
export const jsxDEV = jsx;

/** @param {unknown} value @returns {value is object} */
function observable(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
}

/**
 * Wraps a plain object or array and calls `notify` when a property is added,
 * changed, or deleted through the proxy. Nested plain objects and arrays are
 * wrapped on access. Mutate the returned proxy to trigger notifications.
 * `mount` creates this proxy automatically for app state.
 *
 * @example
 * ```js
 * const state = reactive({ filter: { query: "" } }, () => console.log("Changed"));
 * state.filter.query = "Ada";
 * ```
 *
 * @template {object} State
 * @param {State} initial
 * @param {() => void} notify
 * @returns {State}
 */
export function reactive(initial, notify) {
  if (!observable(initial)) throw new TypeError("State must be a plain object or array");

  /** @type {WeakMap<object, object>} */
  const proxies = new WeakMap();
  /** @type {WeakMap<object, object>} */
  const originals = new WeakMap();

  /** @param {unknown} value @returns {unknown} */
  function wrap(value) {
    if (!observable(value) || originals.has(value)) return value;
    const existing = proxies.get(value);
    if (existing) return existing;

    const proxy = new Proxy(value, {
      get: (target, key, receiver) => wrap(Reflect.get(target, key, receiver)),
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

  return /** @type {State} */ (wrap(initial));
}

/** @param {Node} node */
const keyOf = (node) => metadata.get(node)?.key;

/** @param {Node} a @param {Node} b */
function compatible(a, b) {
  return (
    a.nodeType === b.nodeType &&
    a.nodeName === b.nodeName &&
    (!(a instanceof Element) || (b instanceof Element && a.namespaceURI === b.namespaceURI)) &&
    keyOf(a) === keyOf(b)
  );
}

/**
 * Updates a compatible node in place, or replaces it when it has a parent.
 * Returns the node callers should use after the update.
 *
 * @example
 * ```tsx
 * const before = <p>Loading…</p>;
 * const next = <p>Ready</p>;
 * if (before instanceof Node && next instanceof Node) {
 *   document.body.append(before);
 *   morph(before, next);
 * }
 * ```
 *
 * @param {Node} oldNode
 * @param {Node} nextNode
 */
export function morph(oldNode, nextNode) {
  if (!compatible(oldNode, nextNode)) {
    oldNode.parentNode?.replaceChild(nextNode, oldNode);
    return nextNode;
  }

  if (!(oldNode instanceof Element) || !(nextNode instanceof Element)) {
    if (oldNode.nodeValue !== nextNode.nodeValue) oldNode.nodeValue = nextNode.nodeValue;
    return oldNode;
  }

  // Removing attributes changes the live collection.
  for (const { name } of Array.from(oldNode.attributes)) {
    if (!nextNode.hasAttribute(name)) oldNode.removeAttribute(name);
  }
  for (const { name, value } of nextNode.attributes) {
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
    if (!after || !(name in after.props) || !(name in oldNode)) continue;
    const value = Reflect.get(nextNode, name);
    if (Reflect.get(oldNode, name) !== value) Reflect.set(oldNode, name, value);
  }
  return oldNode;
}

/**
 * Reconciles the children of `parent` against those of `target`.
 * It reads the target's children in order and can move new nodes out of it.
 * Duplicate target sibling keys throw before reconciliation begins.
 *
 * @example
 * ```tsx
 * const desired = <>Latest: <strong>Ready</strong></>;
 * if (desired instanceof DocumentFragment) {
 *   morphChildren(document.body, desired);
 * }
 * ```
 *
 * @param {Element | DocumentFragment} parent
 * @param {Node} target
 */
export function morphChildren(parent, target) {
  if (parent === target) return;

  const previous = [...parent.childNodes];
  const desired = [...target.childNodes];
  const keyed = new Map(
    previous.filter((node) => keyOf(node) != null).map((node) => [keyOf(node), node]),
  );
  const keys = desired.map(keyOf).filter((key) => key != null);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate sibling key");

  const unkeyed = previous.filter((node) => keyOf(node) == null).values();
  let cursor = parent.firstChild;

  for (const node of desired) {
    const key = keyOf(node);
    const candidate = key == null ? unkeyed.next().value : keyed.get(key);
    const chosen = candidate && compatible(candidate, node) ? morph(candidate, node) : node;

    if (chosen !== cursor) {
      if (chosen.parentNode === parent && parent.moveBefore) parent.moveBefore(chosen, cursor);
      else parent.insertBefore(chosen, cursor);
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

/**
 * @template {object} State
 * @typedef {{ path: string, params: Record<string, string>, state: State }} RouteProps
 */

/**
 * @template {object} State
 * @typedef {{ routes: Record<string, (props: RouteProps<State>) => Child>,
 *   notFound?: (props: RouteProps<State>) => Child }} Router
 */

/**
 * Mounts a synchronous view or a hash route table and returns reactive state,
 * a render promise, and an unmount function. The first render and later updates
 * run in microtasks. Multiple writes before a render are batched.
 *
 * Read `app.rendered` after a state change to await that DOM update. The promise
 * rejects if rendering fails. Call `app.unmount()` to clear the root and stop updates.
 *
 * @example
 * ```tsx
 * const app = mount(root, ({ state }) => <p>{state.message}</p>, {
 *   message: "Hello",
 * });
 * app.state.message = "Updated";
 * await app.rendered;
 * ```
 *
 * @example
 * ```tsx
 * // The hash #/items/a%20b?tab=details supplies "a b" as params.id.
 * mount(root, {
 *   routes: {
 *     "/": () => "Home",
 *     "/items/:id": ({ params }) => <h1>{params.id}</h1>,
 *   },
 *   notFound: () => "Page not found",
 * });
 * ```
 *
 * @template {object} [State=object]
 * @param {Element | DocumentFragment} root
 * @param {((props: { state: State }) => Child) | Router<State>} app
 * @param {State} [initial]
 */
export function mount(root, app, initial = /** @type {State} */ ({})) {
  let active = true;
  let pending = false;
  /** @type {Promise<void> | undefined} */
  let rendered;
  /** @type {(props: { state: State }) => Child} */
  let render;
  /** @type {(() => void) | undefined} */
  let stopRouting;
  const state = reactive(initial, schedule);

  if (typeof app === "function") {
    render = app;
  } else {
    const window = root.ownerDocument.defaultView;
    if (!window) throw new TypeError("Routing requires a window");
    const readPath = () => window.location.hash.slice(1).split("?", 1)[0] || "/";
    let path = readPath();
    const view = hashView(app);
    render = ({ state }) => view({ path, state });

    const sync = () => {
      const next = readPath();
      if (next === path) return;
      path = next;
      schedule();
    };

    window.addEventListener("hashchange", sync);
    stopRouting = () => window.removeEventListener("hashchange", sync);
  }

  function schedule() {
    if (!active || pending) return;
    pending = true;

    rendered = Promise.resolve().then(() => {
      pending = false;
      if (!active) return;

      morphChildren(root, appendChildren(document.createDocumentFragment(), render({ state })));
    });
  }

  schedule();
  return {
    state,
    get rendered() {
      return rendered;
    },
    unmount() {
      if (!active) return;
      active = false;
      stopRouting?.();
      root.replaceChildren();
    },
  };
}

/**
 * @template {object} State
 * @param {Router<State>} router
 * @returns {(props: Omit<RouteProps<State>, "params">) => Child}
 */
function hashView({ routes, notFound = () => null }) {
  const patterns = Object.entries(routes).map(([path, view]) => ({
    pattern: path.split("/"),
    view,
  }));

  return ({ path, state }) => {
    let segments;
    try {
      segments = path.split("/").map(decodeURIComponent);
    } catch {
      return notFound({ path, params: {}, state });
    }

    for (const { pattern, view } of patterns) {
      if (pattern.length !== segments.length) continue;

      /** @type {[string, string][]} */
      const entries = [];
      const matches = pattern.every((part, index) => {
        const segment = segments[index];
        if (!part.startsWith(":")) return part === segment;
        if (!segment) return false;
        entries.push([part.slice(1), segment]);
        return true;
      });
      if (matches) return view({ path, params: Object.fromEntries(entries), state });
    }

    return notFound({ path, params: {}, state });
  };
}

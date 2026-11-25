// @vitest-environment jsdom

import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  Fragment,
  NotFound,
  h,
  jsx,
  jsxDEV,
  jsxs,
  morph,
  morphChildren,
  mount,
  reactive,
  tags,
} from "./nova-jsx.js";

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

/** @param {import("./nova-jsx.js").Child} children */
function fragment(children) {
  const result = jsx(Fragment, { children });
  if (!(result instanceof DocumentFragment)) throw new TypeError("Expected a fragment");
  return result;
}

test("JSX flattens children, preserves nodes, and maps DOM attributes and styles", () => {
  const existing = document.createElement("strong");
  const label = jsx("label", {
    htmlFor: "field",
    className: "caption",
    hidden: true,
    title: false,
    style: { fontWeight: 700, "--accent": "red" },
    children: ["Count: ", [null, false, 0, existing, [undefined, true, 2n]]],
  });
  if (!(label instanceof HTMLElement)) throw new TypeError("Expected a label");
  expect(label.textContent).toBe("Count: 02");
  expect(label.firstElementChild).toBe(existing);
  expect(label.getAttribute("for")).toBe("field");
  expect(label.className).toBe("caption");
  expect(label.getAttribute("hidden")).toBe("");
  expect(label.hasAttribute("title")).toBe(false);
  expect(label.style.fontWeight).toBe("700");
  expect(label.style.getPropertyValue("--accent")).toBe("red");
  expect(jsxs).toBe(jsx);
  expect(jsxDEV).toBe(jsx);
});

test("component keys override element keys and reject non-element results", () => {
  const root = document.createElement("main");
  const component = () => jsx("p", { key: "inner", children: "before" });
  const original = jsx(component, null, "outer");
  morphChildren(root, fragment(original));
  morphChildren(root, fragment(jsx("p", { key: "outer", children: "after" })));
  expect(root.firstChild).toBe(original);
  expect(root.textContent).toBe("after");
  expect(jsx(() => "text")).toBe("text");
  expect(() => jsx(() => "text", null, "key")).toThrow("Keyed components must return one element");
});

test("reactive state preserves aliases, cycles, and non-plain object identity", () => {
  const notify = vi.fn();
  const shared = { count: 0 };
  const date = new Date(0);
  /** @type {{ shared: typeof shared, alias: typeof shared, date: Date, self?: object }} */
  const raw = { shared, alias: shared, date };
  raw.self = raw;
  const state = reactive(raw, notify);
  expect(state.shared).not.toBe(shared);
  expect(state.shared).toBe(state.alias);
  expect(state.self).toBe(state);
  expect(state.date).toBe(date);
  state.alias = state.shared;
  expect(raw.alias).toBe(shared);
  expect(notify).not.toHaveBeenCalled();
  state.alias.count = 1;
  expect(state.shared.count).toBe(1);
  expect(notify).toHaveBeenCalledTimes(1);
});

test("reactive state distinguishes additions and deletions from no-ops and failed writes", () => {
  const notify = vi.fn();
  /** @type {{ value: number, optional?: undefined }} */
  const raw = { value: NaN };
  Object.defineProperty(raw, "locked", { value: 1 });
  const state = reactive(raw, notify);
  state.value = NaN;
  delete state.optional;
  expect(Reflect.set(state, "locked", 2)).toBe(false);
  expect(Reflect.deleteProperty(state, "locked")).toBe(false);
  expect(notify).not.toHaveBeenCalled();
  state.optional = undefined;
  delete state.optional;
  state.value = 0;
  state.value = -0;
  expect(Object.is(raw.value, -0)).toBe(true);
  expect(notify).toHaveBeenCalledTimes(4);
  const array = reactive([1], notify);
  array.push();
  expect(notify).toHaveBeenCalledTimes(4);
  array.push(2);
  expect([...array]).toEqual([1, 2]);
  expect(notify).toHaveBeenCalledTimes(5);
  expect(() => reactive(new Map(), notify)).toThrow(TypeError);
});

test("keyed reconciliation reorders retained nodes, removes stale nodes, and replaces incompatible tags", () => {
  const root = document.createElement("main");
  const a = jsx("p", { children: "a" }, 0);
  const b = jsx("p", { children: "b" }, "b");
  const stale = jsx("p", {}, "stale");
  const text = document.createTextNode("before");
  morphChildren(root, fragment([a, text, b, stale]));
  const replacement = jsx("section", {}, "b");
  morphChildren(root, fragment([replacement, jsx("p", { children: "A" }, 0), "after"]));
  expect(root.childNodes).toHaveLength(3);
  expect(root.childNodes[0]).toBe(replacement);
  expect(root.childNodes[1]).toBe(a);
  expect(root.childNodes[2]).toBe(text);
  expect(root.textContent).toBe("Aafter");
  expect(root.contains(/** @type {Node} */ (b))).toBe(false);
  expect(root.contains(/** @type {Node} */ (stale))).toBe(false);
  morphChildren(root, root);
  expect([...root.childNodes]).toEqual([replacement, a, text]);
});

test("duplicate target keys fail before changing the sibling list", () => {
  const root = document.createElement("main");
  root.innerHTML = "<p>original</p>";
  const original = root.firstChild;
  const target = fragment([jsx("p", {}, "x"), jsx("div", {}, "x")]);
  expect(() => morphChildren(root, target)).toThrow("Duplicate sibling key");
  expect(root.firstChild).toBe(original);
  expect(root.textContent).toBe("original");
  expect(target.childNodes).toHaveLength(2);
});

test("morph replaces stale listeners and removes attributes and JSX metadata behavior", () => {
  const oldClick = vi.fn();
  const newClick = vi.fn();
  const button = fragment(
    jsx("button", { onClick: oldClick, title: "old", disabled: true }),
  ).querySelector("button");
  const next = fragment(jsx("button", { onClick: newClick, className: "new" })).querySelector(
    "button",
  );
  if (!button || !next) throw new TypeError("Expected buttons");
  expect(morph(button, next)).toBe(button);
  expect(button.getAttributeNames()).toEqual(["class"]);
  button.click();
  expect(oldClick).not.toHaveBeenCalled();
  expect(newClick).toHaveBeenCalledTimes(1);
  morph(button, document.createElement("button"));
  button.click();
  expect(newClick).toHaveBeenCalledTimes(1);
});

test("mount batches updates and restores controlled form values while retaining input identity", async () => {
  const root = document.createElement("main");
  const render = vi.fn(
    /** @param {{ state: { value: string, checked: boolean } }} props */
    ({ state }) => jsx("input", { type: "checkbox", value: state.value, checked: state.checked }),
  );
  const app = mount(root, render, { value: "before", checked: false });
  expect(render).not.toHaveBeenCalled();
  await app.rendered;
  const input = root.querySelector("input");
  if (!input) throw new TypeError("Expected an input");
  input.value = "local edit";
  app.state.value = "after";
  const pending = app.rendered;
  app.state.checked = true;
  expect(app.rendered).toBe(pending);
  await pending;
  expect(render).toHaveBeenCalledTimes(2);
  expect(root.firstChild).toBe(input);
  expect(input.value).toBe("after");
  expect(input.checked).toBe(true);
  app.state.value = "pending";
  const cancelled = app.rendered;
  app.unmount();
  app.unmount();
  await cancelled;
  app.state.value = "ignored";
  expect(app.rendered).toBe(cancelled);
  expect(render).toHaveBeenCalledTimes(2);
  expect(root.childNodes).toHaveLength(0);
});

test("a failed render rejects its promise and a later update can render successfully", async () => {
  const root = document.createElement("main");
  const app = mount(
    root,
    ({ state }) => {
      if (state.fail) throw new Error("render failed");
      return state.text;
    },
    { fail: false, text: "before" },
  );
  await app.rendered;
  app.state.fail = true;
  await expect(app.rendered).rejects.toThrow("render failed");
  expect(root.textContent).toBe("before");
  app.state.fail = false;
  app.state.text = "after";
  await app.rendered;
  expect(root.textContent).toBe("after");
  app.unmount();
});

test("hash routing decodes segments, ignores query-only changes, and unsubscribes on unmount", async () => {
  const root = document.createElement("main");
  const removeListener = vi.spyOn(window, "removeEventListener");
  const app = mount(root, {
    "/": () => "home",
    "/items/:id": ({ path, params }) => [path, " → ", params.id],
    [NotFound]: ({ path, params }) => ["missing ", path, " ", Object.keys(params).length],
  });
  /** @param {string} hash */
  function navigate(hash) {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return app.rendered;
  }

  try {
    await app.rendered;
    expect(root.textContent).toBe("home");
    await navigate("#/items/a%2Fb?tab=1");
    expect(root.textContent).toBe("/items/a%2Fb → a/b");
    const rendered = app.rendered;
    expect(navigate("#/items/a%2Fb?tab=2")).toBe(rendered);
    await navigate("#/items/");
    expect(root.textContent).toBe("missing /items/ 0");
    await navigate("#/items/%ZZ");
    expect(root.textContent).toBe("missing /items/%ZZ 0");
    app.unmount();
    expect(removeListener).toHaveBeenCalledWith("hashchange", expect.any(Function));
    const stopped = app.rendered;
    expect(navigate("#/items/another")).toBe(stopped);
    expect(root.childNodes).toHaveLength(0);
  } finally {
    app.unmount();
  }
});

test("hash routing captures multiple named segments and discards partial matches", async () => {
  window.history.replaceState(null, "", "#/teams/blue%20sky/members/a%2Fb?tab=details");
  const root = document.createElement("main");
  const member = vi.fn(
    /** @param {import("./nova-jsx.js").RouteProps<object>} props */
    ({ params }) => [params.team, " / ", params.member],
  );
  const notFound = vi.fn(() => "missing");
  const app = mount(root, {
    "/teams/:team/members/:member": member,
    [NotFound]: notFound,
  });

  try {
    await app.rendered;
    expect(root.textContent).toBe("blue sky / a/b");
    expect(member).toHaveBeenCalledExactlyOnceWith({
      path: "/teams/blue%20sky/members/a%2Fb",
      params: { team: "blue sky", member: "a/b" },
      state: app.state,
    });

    window.history.replaceState(null, "", "#/teams/blue%20sky/members/");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await app.rendered;
    expect(root.textContent).toBe("missing");
    expect(notFound).toHaveBeenCalledExactlyOnceWith({
      path: "/teams/blue%20sky/members/",
      params: {},
      state: app.state,
    });
  } finally {
    app.unmount();
  }
});

test("unmatched hash routes render nothing when NotFound is omitted", async () => {
  window.history.replaceState(null, "", "#/missing");
  const root = document.createElement("main");
  root.textContent = "previous";
  const app = mount(root, { "/": () => "home" });

  try {
    await app.rendered;
    expect(root.childNodes).toHaveLength(0);
  } finally {
    app.unmount();
  }
});

test("preserve keeps an unkeyed external host intact until normal updates resume", () => {
  const root = document.createElement("main");
  const originalClick = vi.fn();
  const skippedClick = vi.fn();
  const resumedClick = vi.fn();
  const host = jsx("div", { preserve: true, className: "initial", onClick: originalClick });
  morphChildren(root, fragment([host, jsx("p", { children: "before" })]));
  const terminal = document.createElement("span");
  terminal.textContent = "external terminal";
  host.append(terminal);
  host.dataset.external = "true";
  expect(host.hasAttribute("preserve")).toBe(false);

  morphChildren(
    root,
    fragment([
      jsx("div", { preserve: true, className: "skipped", onClick: skippedClick }),
      jsx("p", { children: "after" }),
    ]),
  );
  expect(root.firstChild).toBe(host);
  expect(root.lastChild?.textContent).toBe("after");
  expect(host.firstChild).toBe(terminal);
  expect(host.className).toBe("initial");
  expect(host.dataset.external).toBe("true");
  host.click();
  expect(originalClick).toHaveBeenCalledTimes(1);
  expect(skippedClick).not.toHaveBeenCalled();

  morphChildren(
    root,
    fragment(
      jsx("div", {
        preserve: false,
        className: "resumed",
        onClick: resumedClick,
        children: "managed",
      }),
    ),
  );
  expect(root.firstChild).toBe(host);
  expect(host.className).toBe("resumed");
  expect(host.hasAttribute("data-external")).toBe(false);
  expect(host.textContent).toBe("managed");
  host.click();
  expect(originalClick).toHaveBeenCalledTimes(1);
  expect(skippedClick).not.toHaveBeenCalled();
  expect(resumedClick).toHaveBeenCalledTimes(1);
});

test("preserve keeps canvas dimensions but allows replacement and removal", () => {
  const root = document.createElement("main");
  const canvas = jsx("canvas", { preserve: true, width: 640, height: 480 }, "preview");
  morphChildren(root, fragment(canvas));
  expect(canvas.width).toBe(640);
  expect(canvas.height).toBe(480);

  morphChildren(root, fragment(jsx("canvas", { preserve: true, width: 320 }, "preview")));
  expect(root.firstChild).toBe(canvas);
  expect(canvas.width).toBe(640);
  expect(canvas.height).toBe(480);

  const replacement = jsx("canvas", { preserve: true, width: 320 }, "new-preview");
  morphChildren(root, fragment(replacement));
  expect(root.firstChild).toBe(replacement);
  expect(replacement.width).toBe(320);
  morphChildren(root, fragment(null));
  expect(root.childNodes).toHaveLength(0);
});

test("h and tags build nodes with positional children and preserve keys", () => {
  const click = vi.fn();
  const button = tags.button({ key: "save", onClick: click }, ["S", ["ave"]]);
  const root = tags.div(null);
  morphChildren(root, h(Fragment, null, button));
  morphChildren(root, h(Fragment, null, h("button", { key: "save", onClick: click }, "Saved")));
  expect(root.firstChild).toBe(button);
  expect(button.textContent).toBe("Saved");
  button.click();
  expect(click).toHaveBeenCalledTimes(1);
  expect(tags["demo-panel"](null).localName).toBe("demo-panel");
});

test("package entry points expose only their public API", async () => {
  const [root, runtime, development] = await Promise.all([
    import("nova-jsx"),
    import("nova-jsx/jsx-runtime"),
    import("nova-jsx/jsx-dev-runtime"),
  ]);
  expect(Object.keys(root).sort()).toEqual(["Fragment", "NotFound", "h", "mount", "tags"]);
  expect(Object.keys(runtime).sort()).toEqual(["Fragment", "jsx", "jsxs"]);
  expect(Object.keys(development).sort()).toEqual(["Fragment", "jsxDEV"]);
  expect(root.Fragment).toBe(runtime.Fragment);
  expect(root.Fragment).toBe(development.Fragment);
});

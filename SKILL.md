---
name: drey
description: >-
  Use when building, editing, or reviewing browser applications that use
  drey. Covers JSX configuration, app-wide hash routing, a shared reactive
  store, and DOM reconciliation.
license: 0BSD
metadata:
  short-description: Build drey apps with one router and one store
---

# DREY

**DREY** stands for **Declarative Reactive Element Yielding**.

DREY creates browser DOM nodes from JSX and updates them from reactive
state. Configure your automatic JSX transform with `drey` as its import
source. In TypeScript, set `jsx` to `"react-jsx"` and `jsxImportSource` to
`"drey"`. In plain JavaScript, use `h` and `tags` to create elements directly.
The leading props object is optional: `h("p", "Hello")`, `tags.p("Hello")`,
and `h(Fragment, tags.p("First"), tags.p("Second"))` need no placeholder.

## Application design

Use one mount point, one hash router, and one reactive store for the entire
app. The URL selects the page, the store holds application data and UI state,
and views derive the DOM from those inputs. Event handlers update the store.

- Call `mount(root, routes, initialState)` once. Define page transitions in a
  single route table. Use links such as `href="#/settings"` and route keys
  such as `"/settings"`. Use the optional `[NotFound]` key for unmatched paths.
- Keep shared and page-specific state in the store created by `mount`.
  Group related fields in nested plain objects or arrays. Route handlers
  receive `{ path, params, state }` and can pass the state their children need.
  The same store remains available across navigation.
- Let the hash be the source of truth for the current page. A named parameter
  such as `:id` captures one non-empty path segment. Route keys use native
  `URLPattern` pathname syntax, including optional segments and wildcards.

```tsx
import { mount, NotFound } from "drey";

const root = document.querySelector("#app");
if (!root) throw new Error("Missing app root");

function Layout({ children }: { children: import("drey").Child }) {
  return (
    <>
      <nav>
        <a href="#/">Home</a> <a href="#/settings">Settings</a>
      </nav>
      <main>{children}</main>
    </>
  );
}

mount(
  root,
  {
    "/": ({ state }) => (
      <Layout>
        <p>{state.settings.compact ? "Compact mode" : "Default mode"}</p>
      </Layout>
    ),
    "/settings": ({ state }) => (
      <Layout>
        <label>
          <input
            type="checkbox"
            checked={state.settings.compact}
            onChange={() => {
              state.settings.compact = !state.settings.compact;
            }}
          />
          Compact mode
        </label>
      </Layout>
    ),
    [NotFound]: () => (
      <Layout>
        <h1>Page not found</h1>
      </Layout>
    ),
  },
  { settings: { compact: false } },
);
```

## Rendering and performance

A state or route change reruns the active view to produce a new DOM tree.
drey compares it with the mounted DOM, reuses compatible nodes, and applies
the necessary updates. State writes before the next render are batched in a
microtask. Use `await app.rendered` after scheduling an update when code needs
to observe the updated DOM.

For typical apps, browser DOM operations are fast enough for this approach.
Keep the shared store and DOM reconciliation as the default. If a large view
or frequent updates cause visible delays, measure DOM creation, reconciliation,
and layout in the browser before introducing finer-grained updates.

Use stable keys for lists that can reorder. For a canvas or an external widget,
`preserve` keeps the attributes, listeners, and descendants of a reused element.

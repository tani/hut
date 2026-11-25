# Nanoapp

Nanoapp is a browser library for rendering DOM nodes from synchronous components,
updating them from reactive state, and routing by URL hash.

## Quick start

Save this HTML next to `nanoapp.js` and serve the directory over HTTP.

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <title>Nanoapp counter</title>
  <main id="app"></main>
  <script type="module">
    import { jsx, mount } from "./nanoapp.js";

    mount(
      document.querySelector("#app"),
      ({ state }) =>
        jsx("button", {
          onClick: () => state.count++,
          children: ["Count: ", state.count],
        }),
      { count: 0 },
    );
  </script>
</html>
```

## Rendering and state

- `jsx(type, props, key)` creates a DOM element, calls a synchronous component,
  or creates a document fragment when passed `Fragment`. `jsxs` and `jsxDEV`
  are aliases. Use the function calls directly in the browser.
- Children can be DOM nodes, text values, or nested arrays. Booleans and nullish
  values are skipped. Components and children must be synchronous. Promises and
  thenables are rejected.
- Use stable sibling keys to preserve compatible DOM nodes when a list is
  reordered. Keys must be unique among siblings. A component with an explicit
  key must return one element.
- `reactive(initial, notify)` observes writes and deletions on plain objects and
  arrays, including nested ones. `mount(root, view, initial)` wraps the initial
  state automatically and returns `{ state, rendered, unmount }`.

The initial render and later updates run in a microtask. Multiple state writes
before that microtask are batched. Read `app.rendered` after scheduling an update
when you need to wait for the DOM, such as in a test. The promise rejects if
rendering fails. `app.unmount()` clears the root and stops future renders and
route updates.

## Hash routing

Pass a route table to `mount` in place of the view function. Route handlers receive
`{ path, params, state }`. For example, `#/items/a%20b?tab=details` matches
`/items/:id` with `params.id` set to `"a b"`. The query string is ignored when
matching routes.

```js
mount(document.querySelector("#app"), {
  routes: {
    "/": () => "Home",
    "/items/:id": ({ params }) => jsx("h1", { children: ["Item ", params.id] }),
  },
  notFound: () => "Page not found",
});
```

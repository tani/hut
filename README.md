# Nanoapp

Nanoapp renders JSX to DOM, updates it from reactive state, and routes by URL hash.

## Quick start

Install Nanoapp with `npm install nanoapp`. Set the JSX import source to
`nanoapp` in your toolchain's automatic JSX transform. For TypeScript, use
`"jsx": "react-jsx"` and `"jsxImportSource": "nanoapp"` in
`compilerOptions`.

With a `<main id="app"></main>` in your HTML, use this JSX module as the entry
point.

```jsx
import { mount } from "nanoapp";

const root = document.querySelector("#app");
if (!root) throw new Error("Missing mount point");

mount(root, ({ state }) => <button onClick={() => state.count++}>Count: {state.count}</button>, {
  count: 0,
});
```

## Rendering and state

- Use `<>…</>` to group siblings without a wrapper element.
- Children can be DOM nodes, text values, or nested arrays. Booleans and nullish
  values are skipped.
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

```jsx
mount(root, {
  routes: {
    "/": () => "Home",
    "/items/:id": ({ params }) => <h1>Item {params.id}</h1>,
  },
  notFound: () => "Page not found",
});
```

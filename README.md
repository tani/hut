# nova-jsx

nova-jsx renders JSX to DOM, updates it from reactive state, and routes by URL hash.

## Quick start

Install nova-jsx with `npm install nova-jsx`. Set the JSX import source to
`nova-jsx` in your toolchain's automatic JSX transform. For TypeScript, use
`"jsx": "react-jsx"` and `"jsxImportSource": "nova-jsx"` in
`compilerOptions`.

With a `<main id="app"></main>` in your HTML, use this JSX module as the entry
point.

```jsx
import { mount } from "nova-jsx";

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

## Preserving external DOM

Use `preserve` on elements managed by other code, such as an xterm.js host or a
canvas. When reconciliation reuses the element, `preserve` skips updates to
its attributes, listeners, and children. A key is optional. Use a stable key
when the element may move among siblings.

```jsx
<section className={state.expanded ? "expanded" : "compact"}>
  <div preserve />
  <canvas preserve />
</section>
```

Removing `preserve` resumes updates. Changing the tag or key can replace the
element. Omitting it from the view removes it as usual.

## Hash routing

Pass a route table to `mount` in place of the view function. Route handlers receive
`{ path, params, state }`. Each `:name` captures one non-empty path segment.
For example, `#/teams/blue%20sky/members/42?tab=details` matches
`/teams/:team/members/:member` with `params.team` set to `"blue sky"` and
`params.member` set to `"42"`. The query string is ignored when matching routes.

```jsx
mount(root, {
  routes: {
    "/": () => "Home",
    "/teams/:team/members/:member": ({ params }) => (
      <h1>
        {params.team} / Member {params.member}
      </h1>
    ),
  },
  notFound: () => "Page not found",
});
```

## License

[BSD Zero Clause License (0BSD)](LICENSE)

# nova-jsx

nova-jsx renders JSX to DOM, updates it from reactive state, and routes by URL hash.

## Quick start

```sh
npm install nova-jsx
```

Set the import source for your toolchain's automatic JSX transform to
`nova-jsx`. For TypeScript, add these options to `tsconfig.json`.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "nova-jsx"
  }
}
```

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
- `mount(root, view, initial)` makes plain objects and arrays in the initial
  state reactive and returns `{ state, rendered, unmount }`.

The initial render and later updates run in a microtask. Multiple state writes
before that microtask are batched. Read `app.rendered` after scheduling an update
when you need to wait for the DOM, such as in a test. The promise rejects if
rendering fails. `app.unmount()` clears the root and stops future renders and
route updates.

## Creating elements in JavaScript

Use `h(type, props, ...children)` or `tags.tagName(props, ...children)` to create
elements in JavaScript files. Pass `null` when the element has no props. Both
accept nested arrays of children and the same props as JSX, including `key`.
Use `h(Fragment, null, ...children)` to group siblings without a wrapper.

```js
import { h, tags } from "nova-jsx";

const list = tags.ul(
  { className: "items" },
  h("li", { key: "first" }, "First item"),
  tags.li({ key: "second" }, "Second item"),
);

document.body.append(list);
```

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

Use the optional `[NotFound]` key to render a fallback. Unmatched paths render
nothing by default.

```jsx
import { mount, NotFound } from "nova-jsx";

mount(root, {
  "/": () => "Home",
  "/teams/:team/members/:member": ({ params }) => (
    <h1>
      {params.team} / Member {params.member}
    </h1>
  ),
  [NotFound]: () => "Page not found",
});
```

## Package exports

| Import path                | Exports                                      |
| -------------------------- | -------------------------------------------- |
| `nova-jsx`                 | `mount`, `NotFound`, `h`, `tags`, `Fragment` |
| `nova-jsx/jsx-runtime`     | `jsx`, `jsxs`, `Fragment`                    |
| `nova-jsx/jsx-dev-runtime` | `jsxDEV`, `Fragment`                         |

Import application APIs from `nova-jsx`. The automatic JSX transform imports
the appropriate runtime for you.

## License

[BSD Zero Clause License (0BSD)](LICENSE)

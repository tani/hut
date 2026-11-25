// SPDX-License-Identifier: 0BSD
// Copyright (c) 2026 Masaya Taniguchi

export declare const Fragment: unique symbol;
export declare const NotFound: unique symbol;

export type Child =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | Node
  | null
  | undefined
  | readonly Child[];

export type Props = Record<string, unknown> & {
  children?: Child;
  key?: unknown;
  preserve?: boolean;
};

export declare namespace JSX {
  type Element = Child;
  type ElementType = string | ((props: never) => Child);

  interface ElementChildrenAttribute {
    children: unknown;
  }

  interface IntrinsicAttributes {
    key?: unknown;
  }

  interface IntrinsicElements {
    [tag: string]: Props;
  }
}

export type ElementMetadata = {
  key: unknown;
  events: Map<string, EventListener>;
  controller: AbortController | undefined;
  props: Props;
};

export declare const metadata: WeakMap<Node, ElementMetadata>;
export declare const formProps: string[];

export declare function jsx(
  type: typeof Fragment,
  props?: Props | null,
  key?: unknown,
): DocumentFragment;
export declare function jsx<Tag extends keyof HTMLElementTagNameMap>(
  type: Tag,
  props?: Props | null,
  key?: unknown,
): HTMLElementTagNameMap[Tag];
export declare function jsx(type: string, props?: Props | null, key?: unknown): HTMLElement;
export declare function jsx<P extends Props>(
  type: string | typeof Fragment | ((props: P) => Child),
  props?: P | null,
  key?: unknown,
): Child;

export declare const jsxs: typeof jsx;
export declare const jsxDEV: typeof jsx;

export declare function h(
  type: typeof Fragment,
  props: Props | null | undefined,
  ...children: Child[]
): DocumentFragment;
export declare function h<Tag extends keyof HTMLElementTagNameMap>(
  type: Tag,
  props: Props | null | undefined,
  ...children: Child[]
): HTMLElementTagNameMap[Tag];
export declare function h(
  type: string,
  props: Props | null | undefined,
  ...children: Child[]
): HTMLElement;
export declare function h<P extends Props>(
  type: string | typeof Fragment | ((props: P) => Child),
  props: P | null | undefined,
  ...children: Child[]
): Child;

export declare const tags: {
  [Tag in keyof HTMLElementTagNameMap]: (
    props?: Props | null,
    ...children: Child[]
  ) => HTMLElementTagNameMap[Tag];
} & Record<string, (props?: Props | null, ...children: Child[]) => HTMLElement>;

export declare function reactive<State extends object>(initial: State, notify: () => void): State;
export declare function morph(oldNode: Node, nextNode: Node): Node;
export declare function morphChildren(parent: Element | DocumentFragment, target: Node): void;

export type RouteProps<State extends object> = {
  path: string;
  params: Record<string, string | undefined>;
  state: State;
};

export type View<State extends object> = (props: RouteProps<State>) => Child;

export type Router<State extends object> = Record<string, View<State>> & {
  [NotFound]?: View<State>;
};

type App<State extends object> = ((props: { state: State }) => Child) | Router<State>;

type MountedApp<State extends object> = {
  state: State;
  readonly rendered: Promise<void>;
  unmount(): void;
};

export declare function mount(
  root: Element | DocumentFragment,
  app: App<object>,
  initial?: undefined,
): MountedApp<object>;
export declare function mount<State extends object>(
  root: Element | DocumentFragment,
  app: App<NoInfer<State>>,
  initial: State,
): MountedApp<State>;

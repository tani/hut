export declare const Fragment: unique symbol;

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

export type Props = Record<string, unknown> & { children?: Child; preserve?: boolean };

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

export declare function reactive<State extends object>(initial: State, notify: () => void): State;
export declare function morph(oldNode: Node, nextNode: Node): Node;
export declare function morphChildren(parent: Element | DocumentFragment, target: Node): void;

export type RouteProps<State extends object> = {
  path: string;
  params: Record<string, string>;
  state: State;
};

export type Router<State extends object> = {
  routes: Record<string, (props: RouteProps<State>) => Child>;
  notFound?: (props: RouteProps<State>) => Child;
};

export declare function mount<State extends object = object>(
  root: Element | DocumentFragment,
  app: ((props: { state: State }) => Child) | Router<State>,
  initial?: State,
): {
  state: State;
  readonly rendered: Promise<void> | undefined;
  unmount(): void;
};

// Minimal React type declarations to satisfy TypeScript compilation for this project.
// These are intentionally lightweight and provide any-typed signatures for the hooks and
// elements used throughout the codebase.

declare module 'react' {
  const React: any;
  export default React;
  export function useState<S>(initialState: S | (() => S)): [S, (newState: S | ((prev: S) => S)) => void];
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  export type ChangeEvent<T = any> = any;
  export type FormEvent<T = any> = any;
  export type ReactNode = any;
  export const Fragment: any;
  // Provide React namespace for compatibility with React.FormEvent etc.
  export namespace React {
    export type FormEvent<T = any> = any;
    export type ChangeEvent<T = any> = any;
    export type Component<P = any, S = any> = any;
    export type ComponentClass<P = any> = any;
  }
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

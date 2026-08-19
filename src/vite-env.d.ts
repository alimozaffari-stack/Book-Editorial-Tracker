/// <reference types="vite/client" />

declare module '*.png' {
  const source: string;
  export default source;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
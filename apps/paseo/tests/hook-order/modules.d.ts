// react-test-renderer ships no types for 19; only the hook-order test uses it.
declare module "react-test-renderer" {
  import type { ReactElement } from "react";
  export interface TestRenderer {
    toJSON(): unknown;
    unmount(): void;
  }
  export function create(element: ReactElement): TestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;
}

// The SDK's own dependency; it ships no types. Only the preview fixtures import it.
declare module "use-sync-external-store/shim/with-selector" {
  export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot: undefined | null | (() => Snapshot),
    selector: (snapshot: Snapshot) => Selection,
    isEqual?: (a: Selection, b: Selection) => boolean,
  ): Selection;
}

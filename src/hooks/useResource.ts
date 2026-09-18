import {useCallback, useEffect, useState} from 'react';

export type ResourceState<T> =
  | {status: 'loading'; data: T | null}
  | {status: 'ready'; data: T}
  | {status: 'error'; data: T | null; error: string};

/**
 * Loading / ready / error / refresh for any async read, in one place. Every
 * list and detail screen uses it, so none of them hand-roll the four states
 * the UI/UX spec requires each screen to cover.
 *
 * `key` re-runs the loader when it changes (filters, pagination, tab).
 */
export function useResource<T>(loader: () => Promise<T>, key: string) {
  const [state, setState] = useState<ResourceState<T>>({status: 'loading', data: null});
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({status: 'loading', data: previous.data}));

    loader()
      .then((data) => {
        if (!cancelled) setState({status: 'ready', data});
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState((previous) => ({
          status: 'error',
          data: previous.data,
          error: error instanceof Error ? error.message : 'Something went wrong',
        }));
      });

    return () => {
      cancelled = true;
    };
    // `loader` is recreated every render by callers; `key` is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadToken]);

  return {state, refresh};
}

import {useEffect, useState} from 'react';

/**
 * Returns `value` only once it has stopped changing for `delay` ms.
 *
 * List screens feed their search box through this so typing "masaki" issues
 * one request instead of six, and the in-flight request for a stale prefix is
 * never the one that wins.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

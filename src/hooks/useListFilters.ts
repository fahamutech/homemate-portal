import {useMemo, useState} from 'react';

export const PAGE_SIZE = 20;

/**
 * Filter + pagination state shared by every list screen: changing a filter
 * resets to the first page, and `key` is the single value that tells
 * useResource when to refetch.
 */
export function useListFilters<T extends Record<string, string>>(initial: T) {
  const [filters, setFilters] = useState<T>(initial);
  const [offset, setOffset] = useState(0);

  function setFilter(key: keyof T, value: string) {
    setFilters((current) => ({...current, [key]: value}));
    setOffset(0);
  }

  function reset() {
    setFilters(initial);
    setOffset(0);
  }

  const key = useMemo(() => JSON.stringify({filters, offset}), [filters, offset]);

  return {filters, setFilter, reset, offset, setOffset, key, limit: PAGE_SIZE};
}

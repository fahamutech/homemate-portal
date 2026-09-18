import {useEffect, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {useAdminApi} from '../../api/AdminApiContext';
import {useDebouncedValue} from '../../hooks/useDebouncedValue';
import {Button, Field, TextInput, fieldStyles} from '../../components/ui';
import styles from './LocationPicker.module.css';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  addressLine?: string;
}

const DAR_ES_SALAAM: [number, number] = [-6.7924, 39.2083];

/**
 * OpenStreetMap location picker: type a place to search (Nominatim, proxied
 * through our API), or drag/click the pin. Coordinates are what the property
 * actually stores — the PostGIS radius search on the registry depends on them.
 *
 * Leaflet is driven imperatively via a ref because it owns its own DOM; React
 * only decides when to create it and what the current marker position is.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
}) {
  const api = useAdminApi();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<{displayName: string; latitude: number; longitude: number}[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedTerm = useDebouncedValue(term, 400);

  // create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start: [number, number] = value ? [value.latitude, value.longitude] : DAR_ES_SALAAM;
    const map = L.map(containerRef.current).setView(start, value ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(start, {draggable: true}).addTo(map);
    marker.on('dragend', () => {
      const {lat, lng} = marker.getLatLng();
      onChangeRef.current({latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6))});
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      onChangeRef.current({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // follow externally-set coordinates (e.g. picking a search result)
  useEffect(() => {
    if (!value || !mapRef.current || !markerRef.current) return;
    const next: [number, number] = [value.latitude, value.longitude];
    markerRef.current.setLatLng(next);
    mapRef.current.setView(next, Math.max(mapRef.current.getZoom(), 15));
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    if (debouncedTerm.trim().length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setError(null);

    api
      .geocode(debouncedTerm.trim())
      .then((response) => {
        if (!cancelled) setResults(response.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Place search failed');
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, api]);

  return (
    <div className={styles.picker}>
      <form
        onSubmit={(event: FormEvent) => event.preventDefault()}
        className={styles.searchRow}
      >
        <Field label="Find a place" htmlFor="location-search">
          <TextInput
            id="location-search"
            placeholder="Masaki, Dar es Salaam"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            autoComplete="off"
          />
        </Field>
      </form>

      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
      {searching && <p className={styles.hint}>Searching OpenStreetMap…</p>}

      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((result) => (
            <li key={`${result.latitude},${result.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    latitude: result.latitude,
                    longitude: result.longitude,
                    addressLine: result.displayName,
                  });
                  setResults([]);
                  setTerm('');
                }}
              >
                {result.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={containerRef} className={styles.map} data-testid="location-map" />

      <div className={styles.coordinates}>
        {value ? (
          <>
            <span>
              Pin at <strong>{value.latitude}</strong>, <strong>{value.longitude}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={async () => {
                const resolved = await api.reverseGeocode(value.latitude, value.longitude);
                if (resolved?.displayName) {
                  onChange({...value, addressLine: resolved.displayName});
                }
              }}
            >
              Use this address
            </Button>
          </>
        ) : (
          <span className={styles.hint}>Search for a place or click the map to drop a pin.</span>
        )}
      </div>
    </div>
  );
}

import {useEffect, useState} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';

/**
 * Files in object storage need credentials, so they cannot be pointed at with
 * a plain <img src>. This fetches the bytes through the API with the admin
 * session and renders them from an object URL, revoked on unmount.
 *
 * The caller says *which* file by naming a source — property media, a KYC
 * document, a profile photo — rather than this component knowing about each
 * one. An identity document and a listing photo are then loaded by the same
 * path, with the same guarantee that the token never reaches a URL.
 */
export type AuthedImageSource =
  | {kind: 'media'; id: string}
  | {kind: 'kycDocument'; id: string}
  | {kind: 'profilePhoto'; userId: string};

export function AuthedImage({
  source,
  thumbnail = false,
  alt,
  className,
}: {
  source: AuthedImageSource;
  thumbnail?: boolean;
  alt: string;
  className?: string;
}) {
  const api = useAdminApi();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const identity = source.kind === 'profilePhoto' ? source.userId : source.id;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    const load =
      source.kind === 'media'
        ? api.fetchMediaBlobUrl(source.id, {thumbnail})
        : source.kind === 'kycDocument'
          ? api.fetchKycDocumentBlobUrl(source.id, {thumbnail})
          : api.fetchProfilePhotoBlobUrl(source.userId, {thumbnail});

    load
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `source` is an object literal at every call site, so its identity is the
    // wrong dependency; the kind and id are what actually select the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, source.kind, identity, thumbnail]);

  if (failed) return <span className={className} role="img" aria-label={`${alt} (unavailable)`}>—</span>;
  if (!src) return <span className={className} aria-busy="true" aria-label={`Loading ${alt}`} />;
  return <img className={className} src={src} alt={alt} />;
}

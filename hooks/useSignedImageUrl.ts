import { useEffect, useState } from 'react';
import { downloadToReceiptCache, getSignedImageUrl, readReceiptCache } from '@/lib/images';

export function useSignedImageUrl(bucket?: string | null, path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!bucket || !path) {
      setUrl(null);
      return;
    }

    (async () => {
      const cached = await readReceiptCache(path);
      if (cancelled) return;
      if (cached) setUrl(cached);

      const signed = await getSignedImageUrl(bucket, path);
      if (cancelled) return;

      if (!signed) {
        if (!cached) setUrl(null);
        return;
      }

      const local = await downloadToReceiptCache(signed, path);
      if (cancelled) return;
      setUrl(local ?? signed);
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  return url;
}

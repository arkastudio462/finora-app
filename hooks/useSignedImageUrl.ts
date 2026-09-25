import { useEffect, useState } from 'react';
import { getSignedImageUrl } from '@/lib/images';

export function useSignedImageUrl(bucket?: string | null, path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!bucket || !path) {
      setUrl(null);
      return;
    }

    getSignedImageUrl(bucket, path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  return url;
}

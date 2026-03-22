import { useState, useEffect } from 'react';
import { getMyShops } from '../lib/shops';

export default function useMyShop() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getMyShops();
        const d = res?.data;
        const shops = Array.isArray(d) ? d : d?.items ?? d ?? [];
        if (shops.length > 0) setShop(shops[0]);
      } catch {
        // user may not have a shop yet
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { shop, shopId: shop?.id ?? null, loading };
}

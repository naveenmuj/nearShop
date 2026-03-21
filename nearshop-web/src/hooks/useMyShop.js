import { useState, useEffect } from 'react'
import { getMyShops } from '../api/shops'

/**
 * Returns the first shop owned by the authenticated business user.
 * Uses GET /shops/mine — no lat/lng hackery needed.
 */
export default function useMyShop() {
  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getMyShops()
      .then(({ data }) => {
        if (!cancelled && data?.length > 0) {
          setShop(data[0])
          setShopId(data[0].id)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { shop, shopId, loading }
}

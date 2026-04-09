export function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

export function distanceKm(fromLat, fromLng, toLat, toLng) {
  if (
    !Number.isFinite(Number(fromLat))
    || !Number.isFinite(Number(fromLng))
    || !Number.isFinite(Number(toLat))
    || !Number.isFinite(Number(toLng))
  ) {
    return null;
  }

  const lat1 = Number(fromLat);
  const lng1 = Number(fromLng);
  const lat2 = Number(toLat);
  const lng2 = Number(toLng);

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function formatDistance(distanceInKm) {
  const km = Number(distanceInKm);
  if (!Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    return `${Math.max(1, Math.round(km * 1000))} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function getShopAreaLabel(shop = {}) {
  return (
    shop?.area
    || shop?.locality
    || shop?.city
    || shop?.address
    || null
  );
}

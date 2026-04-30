/**
 * Haversine 공식 — 두 GPS 좌표 간 거리 계산 (미터 단위)
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6_371_000; // 지구 반지름(m)
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { haversine };

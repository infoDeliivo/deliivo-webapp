export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function decodeRoutePolyline(encoded: string) {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }
  return points;
}

export function distanceFromRouteKm(point: { lat: number; lng: number }, encodedPolyline: string) {
  const path = decodeRoutePolyline(encodedPolyline);
  let minimumDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const meanLatitude = (((start.lat + end.lat + point.lat) / 3) * Math.PI) / 180;
    const longitudeScale = Math.cos(meanLatitude);
    const segmentX = (end.lng - start.lng) * longitudeScale;
    const segmentY = end.lat - start.lat;
    const pointX = (point.lng - start.lng) * longitudeScale;
    const pointY = point.lat - start.lat;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const ratio =
      segmentLengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / segmentLengthSquared));
    const projection = {
      lat: start.lat + ratio * (end.lat - start.lat),
      lng: start.lng + ratio * (end.lng - start.lng),
    };
    minimumDistance = Math.min(minimumDistance, distanceKm(point, projection));
  }
  return minimumDistance;
}

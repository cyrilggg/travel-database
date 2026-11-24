export function resolveGuideIdentity(data, inventory, sourcePath) {
  const countryCode = String(data.country_code).trim();
  if (data.geonames_id === null) {
    const mapId = data.map_id;
    const entry = inventory.centersWithoutGeonames.get(mapId);
    if (!entry || entry.countryCode !== countryCode) {
      throw new Error(`${sourcePath} 的 map_id 缺少同国且无 GeoNames 的名录记录：${mapId}`);
    }
    return { id: mapId, geonamesId: null, coordinates: entry.coordinates };
  }

  if (data.map_id !== undefined) {
    throw new Error(`${sourcePath} 同时声明了 GeoNames 和 map_id`);
  }
  const geonamesId = String(data.geonames_id).trim();
  const coordinates = inventory.coordinatesByGeonamesId.get(geonamesId);
  if (!coordinates) throw new Error(`${sourcePath} 的 GeoNames ${geonamesId} 无坐标`);
  return { id: `${countryCode.toLowerCase()}-${geonamesId}`, geonamesId, coordinates };
}

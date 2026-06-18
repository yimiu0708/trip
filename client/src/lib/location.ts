export function shortLocationName(name?: string) {
  if (!name) return '';
  return name
    .replace(/特别行政区$/, '')
    .replace(/维吾尔自治区$/, '')
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/自治区$/, '')
    .replace(/[省市]$/, '');
}

export function formatLocation(provinceName?: string, cityName?: string) {
  const province = shortLocationName(provinceName);
  const city = shortLocationName(cityName);
  if (!city) return province;
  if (!province || city === province) return city;
  return `${city}｜${province}`;
}

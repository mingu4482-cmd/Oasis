export interface RegionCoordinate {
  name: string;
  lat: number;
  lng: number;
}

export const SEOUL_DISTRICT_COORDINATES: RegionCoordinate[] = [
  { name: '강남구', lat: 37.5172, lng: 127.0473 },
  { name: '강동구', lat: 37.5301, lng: 127.1237 },
  { name: '강북구', lat: 37.6396, lng: 127.0255 },
  { name: '강서구', lat: 37.5509, lng: 126.8495 },
  { name: '관악구', lat: 37.4784, lng: 126.9515 },
  { name: '광진구', lat: 37.5381, lng: 127.0821 },
  { name: '구로구', lat: 37.4954, lng: 126.8874 },
  { name: '금천구', lat: 37.4568, lng: 126.8954 },
  { name: '노원구', lat: 37.6542, lng: 127.0568 },
  { name: '도봉구', lat: 37.6688, lng: 127.0471 },
  { name: '동대문구', lat: 37.5744, lng: 127.04 },
  { name: '동작구', lat: 37.5124, lng: 126.9393 },
  { name: '마포구', lat: 37.5662, lng: 126.9016 },
  { name: '서대문구', lat: 37.5791, lng: 126.9368 },
  { name: '서초구', lat: 37.4836, lng: 127.0327 },
  { name: '성동구', lat: 37.5633, lng: 127.0369 },
  { name: '성북구', lat: 37.5891, lng: 127.0182 },
  { name: '송파구', lat: 37.5145, lng: 127.1058 },
  { name: '양천구', lat: 37.5169, lng: 126.8664 },
  { name: '영등포구', lat: 37.5264, lng: 126.8962 },
  { name: '용산구', lat: 37.5326, lng: 126.9900 },
  { name: '은평구', lat: 37.6027, lng: 126.9291 },
  { name: '종로구', lat: 37.5729, lng: 126.9793 },
  { name: '중구', lat: 37.5636, lng: 126.9975 },
  { name: '중랑구', lat: 37.6065, lng: 127.0924 },
];

const MONITORED_REGION_NAMES = new Set([
  '강남구', '서초구', '동작구', '관악구', '영등포구',
  '마포구', '성동구', '광진구', '구로구', '양천구',
]);

export const REGION_COORDINATES = SEOUL_DISTRICT_COORDINATES.filter((region) =>
  MONITORED_REGION_NAMES.has(region.name),
);

export const DEFAULT_REGION_COORDINATE = REGION_COORDINATES[0];

export function findRegionCoordinate(regionName: string | undefined) {
  return SEOUL_DISTRICT_COORDINATES.find((region) => region.name === regionName) ?? DEFAULT_REGION_COORDINATE;
}

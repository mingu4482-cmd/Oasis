export interface RegionCoordinate {
  name: string;
  lat: number;
  lng: number;
}

export const REGION_COORDINATES: RegionCoordinate[] = [
  { name: '강남구', lat: 37.5172, lng: 127.0473 },
  { name: '서초구', lat: 37.4836, lng: 127.0327 },
  { name: '동작구', lat: 37.5124, lng: 126.9393 },
  { name: '관악구', lat: 37.4784, lng: 126.9516 },
  { name: '영등포구', lat: 37.5264, lng: 126.8963 },
  { name: '마포구', lat: 37.5663, lng: 126.9019 },
  { name: '성동구', lat: 37.5633, lng: 127.0369 },
  { name: '광진구', lat: 37.5385, lng: 127.0823 },
  { name: '구로구', lat: 37.4955, lng: 126.8874 },
  { name: '양천구', lat: 37.517, lng: 126.8665 },
];

export const DEFAULT_REGION_COORDINATE = REGION_COORDINATES[0];

export function findRegionCoordinate(regionName: string | undefined) {
  return REGION_COORDINATES.find((region) => region.name === regionName) ?? DEFAULT_REGION_COORDINATE;
}

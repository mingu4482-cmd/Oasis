import { apiClient } from "./client";

export interface DistrictBoundary {
  name: string;
  code: string;
  paths: Array<Array<{ lat: number; lng: number }>>;
}

interface VWorldFeature {
  properties?: {
    sig_cd?: string;
    sig_kor_nm?: string;
    full_nm?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

interface VWorldResponse {
  response?: {
    result?: {
      featureCollection?: {
        features?: VWorldFeature[];
      };
    };
  };
}

function toPath(ring: unknown): Array<{ lat: number; lng: number }> {
  if (!Array.isArray(ring)) return [];

  return ring
    .map((coordinate) => {
      if (!Array.isArray(coordinate)) return null;
      const [lng, lat] = coordinate;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return { lat, lng };
    })
    .filter((point): point is { lat: number; lng: number } => point !== null);
}

function toBoundaryPaths(geometry: VWorldFeature["geometry"]) {
  if (!geometry?.coordinates) return [];

  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.map(toPath).filter((path) => path.length > 2);
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.flatMap((polygon) =>
      Array.isArray(polygon)
        ? polygon.map(toPath).filter((path) => path.length > 2)
        : [],
    );
  }

  return [];
}

export async function fetchSeoulDistrictBoundaries(): Promise<DistrictBoundary[]> {
  const response = await apiClient.get<VWorldResponse>("/vworld/seoul-districts");
  const data = response.data;
  const features =
    data.response?.result?.featureCollection?.features?.filter(
      (feature) => feature.properties?.sig_cd?.startsWith("11"),
    ) ?? [];

  return features
    .map((feature) => {
      const properties = feature.properties;
      return {
        name: properties?.sig_kor_nm ?? properties?.full_nm ?? "",
        code: properties?.sig_cd ?? "",
        paths: toBoundaryPaths(feature.geometry),
      };
    })
    .filter((boundary) => boundary.name && boundary.paths.length > 0);
}

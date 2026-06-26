const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const EXTERNAL_SENSOR_API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_EXTERNAL_SENSOR_API_BASE_URL ?? 'http://localhost:8080',
);

export const SWMM_API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_SWMM_API_BASE_URL ?? 'http://localhost:8080',
);


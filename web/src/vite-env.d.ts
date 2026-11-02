/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional map tile URL template, e.g. a MapTiler or Stadia style with your own key. */
  readonly VITE_TILE_URL?: string;
  readonly VITE_TILE_ATTRIBUTION?: string;
  /** Base URL of a hosted Raahi server (e.g. https://raahi-api.onrender.com). Empty = use bundled data. */
  readonly VITE_API_URL?: string;
  readonly VITE_STATIC?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

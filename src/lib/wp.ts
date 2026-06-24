// WordPress host detection. When Strata runs inside wp-admin, the plugin
// localizes `window.StrataBoot` (REST base URL + nonce). Standalone builds
// have no such global → IS_WP is false and the app uses api.php + profiles.

export interface StrataBoot {
  /** REST namespace base, e.g. https://site/wp-json/strata/v1 (no trailing slash). */
  restUrl: string;
  /** wp_rest nonce for the X-WP-Nonce header. */
  nonce: string;
  /** Plugin version. */
  version: string;
  /** URL to the bundled assets dir (for the logo etc.). */
  assetsUrl: string;
}

export const wpBoot: StrataBoot | null =
  (typeof window !== 'undefined' && (window as unknown as { StrataBoot?: StrataBoot }).StrataBoot) ||
  null;

export const IS_WP = !!wpBoot;

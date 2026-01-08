/**
 * Marketing Configuration Module
 * src/config/marketing.ts
 *
 * Provides typed configuration for Meta Conversions API (CAPI).
 * Validates required fields when CAPI is enabled.
 */

export interface MetaCapiConfig {
  enabled: boolean;
  pixelId: string;
  accessToken: string;
  useTestMode: boolean;
  testEventCode: string;
}

/**
 * Parse boolean environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Load and validate Meta CAPI configuration from environment variables.
 * Logs warnings if enabled but missing required fields.
 */
function loadMetaCapiConfig(): MetaCapiConfig {
  const enabled = parseBool(process.env.META_CAPI_ENABLED, false);
  const pixelId = process.env.META_PIXEL_ID || "";
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN || "";
  const useTestMode = parseBool(process.env.META_CAPI_USE_TEST_MODE, true);
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE || "";

  // Validate required fields when enabled
  if (enabled) {
    const missing: string[] = [];
    if (!pixelId) missing.push("META_PIXEL_ID");
    if (!accessToken) missing.push("META_CAPI_ACCESS_TOKEN");

    if (missing.length > 0) {
      console.warn(
        `[MetaCAPI] WARNING: META_CAPI_ENABLED=true but missing: ${missing.join(", ")}. ` +
        `CAPI tracking will be disabled until these are configured.`
      );
      return {
        enabled: false,
        pixelId,
        accessToken,
        useTestMode,
        testEventCode,
      };
    }

    console.log(
      `[MetaCAPI] Initialized with Pixel ID: ${pixelId.substring(0, 8)}... ` +
      `Test mode: ${useTestMode}`
    );
  }

  return {
    enabled,
    pixelId,
    accessToken,
    useTestMode,
    testEventCode,
  };
}

/** Singleton config instance */
export const metaCapiConfig = loadMetaCapiConfig();

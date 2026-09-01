declare const STARTUP_SCRIPT_BASE64: string;

/**
 * Returns the default startup script embedded from the authoritative Markdown
 * asset by the Rollup build.
 */
export const startupScript = (): string => atob(STARTUP_SCRIPT_BASE64);

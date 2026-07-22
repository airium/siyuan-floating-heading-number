import {
    HEADING_NUMBER_PLACEMENTS,
    type HeadingNumberPlacement,
    type HeadingNumberRenderPreferences,
    type PluginSettings,
} from "./types";

export const DEFAULT_MINIMUM_GUTTER_WIDTH = 48;
export const MINIMUM_GUTTER_WIDTH_MIN = 0;
export const MINIMUM_GUTTER_WIDTH_MAX = 512;
export const DEFAULT_HEADING_NUMBER_PREFIX = "§";
export const DEFAULT_HEADING_NUMBER_SUFFIX = "";
export const DEFAULT_RENDER_PREFERENCES: HeadingNumberRenderPreferences = {
    placement: "outside-left",
    minimumGutterWidth: DEFAULT_MINIMUM_GUTTER_WIDTH,
    prefix: DEFAULT_HEADING_NUMBER_PREFIX,
    suffix: DEFAULT_HEADING_NUMBER_SUFFIX,
};
export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
    enabled: true,
    ...DEFAULT_RENDER_PREFERENCES,
};

const placementSet = new Set<string>(HEADING_NUMBER_PLACEMENTS);

export function isHeadingNumberPlacement(value: unknown): value is HeadingNumberPlacement {
    return typeof value === "string" && placementSet.has(value);
}

export function isOutsidePlacement(placement: HeadingNumberPlacement): boolean {
    return placement === "outside-left" || placement === "outside-right";
}

export function normalizeMinimumGutterWidth(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_MINIMUM_GUTTER_WIDTH;
    }
    return Math.min(
        MINIMUM_GUTTER_WIDTH_MAX,
        Math.max(MINIMUM_GUTTER_WIDTH_MIN, Math.round(value)),
    );
}

export function parsePluginSettings(value: unknown): PluginSettings {
    if (!isRecord(value)) {
        return {...DEFAULT_PLUGIN_SETTINGS};
    }
    return {
        enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_PLUGIN_SETTINGS.enabled,
        placement: isHeadingNumberPlacement(value.placement) ? value.placement : DEFAULT_PLUGIN_SETTINGS.placement,
        minimumGutterWidth: normalizeMinimumGutterWidth(value.minimumGutterWidth),
        prefix: typeof value.prefix === "string" ? value.prefix : DEFAULT_PLUGIN_SETTINGS.prefix,
        suffix: typeof value.suffix === "string" ? value.suffix : DEFAULT_PLUGIN_SETTINGS.suffix,
    };
}

export function renderPreferences(settings: PluginSettings): HeadingNumberRenderPreferences {
    return {
        placement: settings.placement,
        minimumGutterWidth: settings.minimumGutterWidth,
        prefix: settings.prefix,
        suffix: settings.suffix,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

import {
    describe,
    expect,
    it,
} from "vitest";
import {
    DEFAULT_HEADING_NUMBER_PREFIX,
    DEFAULT_PLUGIN_SETTINGS,
    isOutsidePlacement,
    normalizeMinimumGutterWidth,
    parsePluginSettings,
} from "../src/settings";

describe("plugin settings", () => {
    it("uses stable defaults for missing or malformed settings", () => {
        expect(parsePluginSettings(undefined)).toEqual(DEFAULT_PLUGIN_SETTINGS);
        expect(parsePluginSettings([])).toEqual(DEFAULT_PLUGIN_SETTINGS);
        expect(parsePluginSettings({enabled: "yes", placement: "center", minimumGutterWidth: "48"}))
            .toEqual(DEFAULT_PLUGIN_SETTINGS);
    });

    it("migrates legacy enabled-only settings", () => {
        expect(parsePluginSettings({enabled: false})).toEqual({
            enabled: false,
            placement: "outside-left",
            minimumGutterWidth: 48,
            prefix: "§",
            suffix: "",
        });
    });

    it("migrates pre-affix settings and preserves placement and gutter width", () => {
        expect(parsePluginSettings({
            enabled: false,
            placement: "after-text",
            minimumGutterWidth: 72,
        })).toEqual({
            enabled: false,
            placement: "after-text",
            minimumGutterWidth: 72,
            prefix: "§",
            suffix: "",
        });
    });

    it("preserves custom and empty affixes exactly", () => {
        expect(parsePluginSettings({
            enabled: true,
            placement: "inside-left",
            minimumGutterWidth: 48,
            prefix: "Chapter ",
            suffix: " —",
        })).toEqual({
            enabled: true,
            placement: "inside-left",
            minimumGutterWidth: 48,
            prefix: "Chapter ",
            suffix: " —",
        });
        expect(parsePluginSettings({prefix: "", suffix: ""})).toMatchObject({prefix: "", suffix: ""});
    });

    it("replaces malformed affixes independently with defaults", () => {
        expect(parsePluginSettings({prefix: 123, suffix: null})).toMatchObject({
            prefix: DEFAULT_HEADING_NUMBER_PREFIX,
            suffix: "",
        });
    });

    it.each([
        [-10, 0],
        [12.4, 12],
        [12.6, 13],
        [900, 512],
        [Number.NaN, 48],
        [Number.POSITIVE_INFINITY, 48],
    ])("normalizes gutter width %s to %s", (value, expected) => {
        expect(normalizeMinimumGutterWidth(value)).toBe(expected);
    });

    it("identifies only the two outside placements", () => {
        expect(isOutsidePlacement("outside-left")).toBe(true);
        expect(isOutsidePlacement("outside-right")).toBe(true);
        expect(isOutsidePlacement("inside-left")).toBe(false);
        expect(isOutsidePlacement("inside-right")).toBe(false);
        expect(isOutsidePlacement("after-text")).toBe(false);
    });
});

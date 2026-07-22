import {compile} from "sass";
import {
    describe,
    expect,
    it,
} from "vitest";
import {HEADING_NUMBER_PLACEMENTS} from "../src/types";

const css = compile("src/index.scss", {style: "expanded"}).css;

describe("heading number placement styles", () => {
    it("contains a presentation branch for every placement", () => {
        HEADING_NUMBER_PLACEMENTS.forEach((placement) => {
            expect(css).toContain(`[data-siyuan-floating-heading-number-placement=${placement}]`);
        });
        expect(css).toContain("right: calc(100% + var(--siyuan-floating-heading-number-gap, 8px))");
        expect(css).toContain("left: calc(100% + var(--siyuan-floating-heading-number-gap, 8px))");
        expect(css).toContain("left: 0");
        expect(css).toContain("right: 0");
        expect(css).toContain("> [contenteditable]:first-child::after");
        expect(css).toContain("margin-inline-start: var(--siyuan-floating-heading-number-gap, 0px)");
    });

    it("keeps folded-arrow reservation on outside-left only", () => {
        expect(css).toContain("[data-siyuan-floating-heading-number-placement=outside-left]");
        expect(css).toContain('[fold="1"]:not([class*=dragover])::after');
        expect(css).toContain("right: calc(100% + 16px + 6px)");
    });

    it("suppresses non-hover interaction states through stable opacity for every placement", () => {
        expect(css).toContain(".protyle-wysiwyg--hiderange");
        expect(css).toContain(".protyle-wysiwyg--selecting");
        expect(css).toContain(".protyle-wysiwyg--select");
        expect(css).toContain(".protyle-wysiwyg--hl");
        expect(css).toContain("[select-start]");
        expect(css).toContain("[select-end]");
        expect(css).toContain("[class*=dragover]");
        expect(css).toContain("--siyuan-floating-heading-number-opacity: 0");
        expect(css).toContain("opacity: var(--siyuan-floating-heading-number-opacity, 1)");
    });

    it("keeps non-gutter numbers visible while hovering headings", () => {
        const hoverRule = css.match(/[^{}]*:hover\s*\{[^{}]*--siyuan-floating-heading-number-opacity:\s*0;?[^{}]*\}/)
            ?.[0];

        expect(hoverRule).toBeDefined();
        expect(hoverRule).toContain(
            ":not([data-siyuan-floating-heading-number-placement=inside-left])",
        );
        expect(hoverRule).toContain(
            ":not([data-siyuan-floating-heading-number-placement=inside-right])",
        );
        expect(hoverRule).toContain(
            ":not([data-siyuan-floating-heading-number-placement=after-text])",
        );
    });
});

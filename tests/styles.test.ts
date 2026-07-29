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
        expect(css).toContain("> [contenteditable]:first-child::before");
        expect(css).toContain("> [contenteditable]:first-child::after");
        expect(css).toContain("margin-inline-start: var(--siyuan-floating-heading-number-gap, 0px)");
    });

    it("keeps folded-arrow reservation on outside-left only", () => {
        expect(css).toContain("[data-siyuan-floating-heading-number-placement=outside-left]");
        expect(css).toContain('[fold="1"] > [contenteditable]:first-child::before');
        expect(css).toContain("right: calc(100% + 16px + 6px)");
    });

    it("leaves heading-block pseudo-elements available to SiYuan", () => {
        expect(css).not.toMatch(/\[data-type=NodeHeading\]::(?:before|after)/);
        expect(css).not.toMatch(/\[data-type=NodeHeading\]\[[^\]]+\]::(?:before|after)/);
    });

    it("keeps numbers visible during selection while suppressing drag interactions", () => {
        expect(css).not.toContain(".protyle-wysiwyg--hiderange");
        expect(css).not.toContain(".protyle-wysiwyg--selecting");
        expect(css).not.toContain(".protyle-wysiwyg--select");
        expect(css).not.toContain(".protyle-wysiwyg--hl");
        expect(css).not.toContain("[select-start]");
        expect(css).not.toContain("[select-end]");
        expect(css).toContain("[class*=dragover]");
        expect(css).toContain("--siyuan-floating-heading-number-opacity: 0");
        expect(css).toContain("opacity: var(--siyuan-floating-heading-number-opacity, 1)");
        expect(css).toContain("user-select: none");
    });

    it("restricts outside hover suppression to fine-pointer hover devices", () => {
        const mediaQuery = "@media (hover: hover) and (pointer: fine)";
        const mediaQueryIndex = css.indexOf(mediaQuery);
        const hoverRule = css.match(/[^{}]*:hover\s*\{[^{}]*--siyuan-floating-heading-number-opacity:\s*0;?[^{}]*\}/)
            ?.[0];

        expect(mediaQueryIndex).toBeGreaterThanOrEqual(0);
        expect(css.slice(0, mediaQueryIndex)).not.toContain("NodeHeading]:hover");
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

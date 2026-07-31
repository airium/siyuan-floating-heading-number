import {compile} from "sass";
import {
    describe,
    expect,
    it,
} from "vitest";
import {HEADING_NUMBER_PLACEMENTS} from "../src/types";

const css = compile("src/index.scss", {style: "expanded"}).css;

const ruleFor = (selectorFragment: string) => {
    const selectorIndex = css.indexOf(selectorFragment);
    const openingBraceIndex = css.indexOf("{", selectorIndex);
    const closingBraceIndex = css.indexOf("}", openingBraceIndex);

    expect(selectorIndex).toBeGreaterThanOrEqual(0);
    expect(openingBraceIndex).toBeGreaterThan(selectorIndex);
    expect(closingBraceIndex).toBeGreaterThan(openingBraceIndex);
    return css.slice(openingBraceIndex + 1, closingBraceIndex);
};

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

    it("inherits block-level typography", () => {
        expect(css).toContain("color: inherit");
        expect(css).toContain("font-family: inherit");
        expect(css).toContain("font-style: inherit");
        expect(css).toContain("font-weight: inherit");
        expect(css).not.toContain("font-weight: 600");
        expect(css).not.toContain("color: var(--b3-theme-on-surface-light)");
    });

    it("keeps fixed geometry on absolute placements without expanding after-text lines", () => {
        const outsideLeftRule = ruleFor(
            "[data-siyuan-floating-heading-number-placement=outside-left] .protyle-wysiwyg",
        );
        const afterTextRule = ruleFor(
            "[data-siyuan-floating-heading-number-placement=after-text] .protyle-wysiwyg",
        );

        expect(outsideLeftRule).toContain("height: 1.625em");
        expect(outsideLeftRule).toContain("overflow: hidden");
        expect(outsideLeftRule).toContain("line-height: 1.625");

        expect(afterTextRule).toContain("display: inline-block");
        expect(afterTextRule).toContain("height: auto");
        expect(afterTextRule).toContain("overflow: visible");
        expect(afterTextRule).toContain("line-height: inherit");
        expect(afterTextRule).toContain("vertical-align: baseline");
        expect(afterTextRule).not.toContain("height: 1.625em");
        expect(afterTextRule).not.toContain("overflow: hidden");
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

import {EXCLUDED_HEADING_CONTAINER_SELECTOR} from "./numbering";
import type {
    HeadingNumberPlacement,
    HeadingNumberRenderPreferences,
    HeadingSnapshot,
    MinimalProtyle,
} from "./types";

export const HEADING_NUMBER_MAX_WIDTH = 96;
export const HEADING_NUMBER_GAP = 8;
export const HEADING_NUMBER_FOLDED_GAP = 6;
export const HEADING_NUMBER_FOLDED_MARKER_WIDTH = 16;

const HEADING_SELECTOR = '[data-node-id][data-type="NodeHeading"][data-subtype]';
const MIN_WIDTH = 8;
const MIN_FONT_SIZE = 1;
let measureCanvas: HTMLCanvasElement | undefined;

export interface RenderOptions {
    controllerId: string;
    enabled: boolean;
    gutterHeadingId?: string;
    renderPreferences: HeadingNumberRenderPreferences;
    protyle: MinimalProtyle;
    snapshot?: HeadingSnapshot;
    styleElement: HTMLStyleElement;
}

export function isProtyleSupported(protyle: MinimalProtyle): boolean {
    return !protyle.options.backlinkData &&
        !protyle.options.history &&
        !protyle.options.action?.includes("cb-get-history");
}

export function clearHeadingNumberRendering(host: HTMLElement, styleElement: HTMLStyleElement): void {
    delete host.dataset.siyuanFloatingHeadingNumberPlugin;
    delete host.dataset.siyuanFloatingHeadingNumberGutterId;
    delete host.dataset.siyuanFloatingHeadingNumberPlacement;
    styleElement.textContent = "";
}

export function renderHeadingNumbers(options: RenderOptions): void {
    const {controllerId, enabled, gutterHeadingId, protyle, renderPreferences, snapshot, styleElement} = options;
    const host = protyle.element;
    const wysiwyg = protyle.wysiwyg.element;
    const computedStyle = window.getComputedStyle(wysiwyg);
    if (
        !enabled || !snapshot || snapshot.rootId !== protyle.block.rootID || !isProtyleSupported(protyle) ||
        !hasRequiredGutter(computedStyle, renderPreferences)
    ) {
        clearHeadingNumberRendering(host, styleElement);
        return;
    }

    host.dataset.siyuanFloatingHeadingNumberPlugin = controllerId;
    host.dataset.siyuanFloatingHeadingNumberPlacement = renderPreferences.placement;
    if (gutterHeadingId) {
        host.dataset.siyuanFloatingHeadingNumberGutterId = gutterHeadingId;
    } else {
        delete host.dataset.siyuanFloatingHeadingNumberGutterId;
    }

    const hostSelector = `[data-siyuan-floating-heading-number-plugin="${escapeCssString(controllerId)}"]`;
    const rules: string[] = [];
    const renderedHeadingIds = new Set<string>();
    const wysiwygRect = wysiwyg.getBoundingClientRect();
    const baseFontSize = Number.parseFloat(computedStyle.fontSize) || 16;
    const fontFamily = computedStyle.fontFamily || "sans-serif";

    wysiwyg.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach((heading) => {
        if (heading.closest(EXCLUDED_HEADING_CONTAINER_SELECTOR)) {
            return;
        }
        const id = heading.getAttribute("data-node-id");
        const number = id ? snapshot.numberById.get(id) : undefined;
        if (!id || !number) {
            return;
        }
        const label = `${renderPreferences.prefix}${number}${renderPreferences.suffix}`;

        const sizing = measureSizing(
            wysiwygRect,
            heading,
            label,
            baseFontSize,
            fontFamily,
            renderPreferences.placement,
        );
        const selector = `${hostSelector} .protyle-wysiwyg ` +
            `[data-node-id="${escapeCssString(id)}"][data-type="NodeHeading"]`;
        rules.push(
            `${selector}{--siyuan-floating-heading-number-content:"${escapeCssString(label)}";` +
                `--siyuan-floating-heading-number-font-size:${sizing.fontSize}px;` +
                `--siyuan-floating-heading-number-gap:${HEADING_NUMBER_GAP}px;` +
                `--siyuan-floating-heading-number-width:${sizing.width}px;}`,
        );
        if (renderPreferences.placement === "inside-left" || renderPreferences.placement === "inside-right") {
            const paddingProperty = renderPreferences.placement === "inside-left" ? "padding-left" : "padding-right";
            rules.push(
                `${selector}>[contenteditable]:first-child{${paddingProperty}:` +
                    `calc(${sizing.width}px + ${HEADING_NUMBER_GAP}px);}`,
            );
        }
        renderedHeadingIds.add(id);
    });

    const gutterMayOverlapNumber = renderPreferences.placement === "outside-left" ||
        renderPreferences.placement === "outside-right";
    if (gutterMayOverlapNumber && gutterHeadingId && renderedHeadingIds.has(gutterHeadingId)) {
        rules.push(
            `${hostSelector}[data-siyuan-floating-heading-number-gutter-id="${escapeCssString(gutterHeadingId)}"] ` +
                `[data-node-id="${escapeCssString(gutterHeadingId)}"][data-type="NodeHeading"]` +
                "{--siyuan-floating-heading-number-opacity:0;}",
        );
    }
    styleElement.textContent = rules.join("\n");
}

export function escapeCssString(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\0/g, "\uFFFD")
        .replace(/\r\n|\r|\n|\f/g, (character) => `\\${character.codePointAt(0)?.toString(16)} `);
}

function hasRequiredGutter(
    computedStyle: CSSStyleDeclaration,
    renderPreferences: HeadingNumberRenderPreferences,
): boolean {
    if (renderPreferences.placement !== "outside-left" && renderPreferences.placement !== "outside-right") {
        return true;
    }
    const paddingValue = renderPreferences.placement === "outside-left" ?
        computedStyle.paddingLeft :
        computedStyle.paddingRight;
    const padding = Number.parseFloat(paddingValue);
    return Number.isFinite(padding) && padding >= renderPreferences.minimumGutterWidth;
}

function measureSizing(
    wysiwygRect: DOMRect,
    heading: HTMLElement,
    number: string,
    baseFontSize: number,
    fontFamily: string,
    placement: HeadingNumberPlacement,
): {fontSize: number; width: number;} {
    const headingRect = heading.getBoundingClientRect();
    const folded = heading.getAttribute("fold") === "1";
    const foldedOutsideLeft = folded && placement === "outside-left";
    const gap = foldedOutsideLeft ? HEADING_NUMBER_FOLDED_GAP : HEADING_NUMBER_GAP;
    const minimumWidth = foldedOutsideLeft ? MIN_FONT_SIZE : MIN_WIDTH;
    let availableWidth = HEADING_NUMBER_MAX_WIDTH;

    if (wysiwygRect.width > 0 && headingRect.width > 0 && placement === "outside-left") {
        const reservedWidth = foldedOutsideLeft ? HEADING_NUMBER_FOLDED_MARKER_WIDTH + gap : gap;
        availableWidth = Math.min(
            HEADING_NUMBER_MAX_WIDTH,
            Math.max(
                minimumWidth,
                Math.floor(headingRect.left - wysiwygRect.left - reservedWidth - 1),
            ),
        );
    } else if (wysiwygRect.width > 0 && headingRect.width > 0 && placement === "outside-right") {
        availableWidth = Math.min(
            HEADING_NUMBER_MAX_WIDTH,
            Math.max(
                minimumWidth,
                Math.floor(wysiwygRect.right - headingRect.right - gap - 1),
            ),
        );
    }

    const textWidth = measureText(number, baseFontSize, fontFamily);
    const fontSize = textWidth > availableWidth ?
        Math.max(MIN_FONT_SIZE, Math.floor(baseFontSize * availableWidth / textWidth * 100) / 100) :
        baseFontSize;
    const width = textWidth > availableWidth ?
        availableWidth :
        Math.min(availableWidth, Math.max(minimumWidth, Math.ceil(textWidth)));
    return {fontSize, width};
}

function measureText(number: string, fontSize: number, fontFamily: string): number {
    try {
        measureCanvas ??= document.createElement("canvas");
        const context = measureCanvas.getContext("2d");
        if (context) {
            context.font = `600 ${fontSize}px ${fontFamily}`;
            return context.measureText(number).width;
        }
    } catch {
        // The proportional fallback is used in DOM implementations without a canvas context.
    }
    return number.length * fontSize * 0.6;
}

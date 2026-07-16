import type {
    HeadingSnapshot,
    MinimalProtyle,
} from "./types";

export const HEADING_NUMBER_MIN_GUTTER = 48;
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
    styleElement.textContent = "";
}

export function renderHeadingNumbers(options: RenderOptions): void {
    const {controllerId, enabled, gutterHeadingId, protyle, snapshot, styleElement} = options;
    const host = protyle.element;
    const wysiwyg = protyle.wysiwyg.element;
    if (
        !enabled || !snapshot || snapshot.rootId !== protyle.block.rootID || !isProtyleSupported(protyle) ||
        !hasHeadingNumberGutter(wysiwyg)
    ) {
        clearHeadingNumberRendering(host, styleElement);
        return;
    }

    host.dataset.siyuanFloatingHeadingNumberPlugin = controllerId;
    if (gutterHeadingId) {
        host.dataset.siyuanFloatingHeadingNumberGutterId = gutterHeadingId;
    } else {
        delete host.dataset.siyuanFloatingHeadingNumberGutterId;
    }

    const hostSelector = `[data-siyuan-floating-heading-number-plugin="${escapeCssString(controllerId)}"]`;
    const rules: string[] = [];
    const wysiwygRect = wysiwyg.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(wysiwyg);
    const baseFontSize = Number.parseFloat(computedStyle.fontSize) || 16;
    const fontFamily = computedStyle.fontFamily || "sans-serif";

    wysiwyg.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach((heading) => {
        const id = heading.getAttribute("data-node-id");
        const number = id ? snapshot.numberById.get(id) : undefined;
        if (!id || !number) {
            return;
        }

        const sizing = measureSizing(wysiwygRect, heading, number, baseFontSize, fontFamily);
        const selector =
            `${hostSelector} .protyle-wysiwyg:not(.protyle-wysiwyg--hiderange):not(.protyle-wysiwyg--selecting) ` +
            `[data-node-id="${escapeCssString(id)}"][data-type="NodeHeading"]` +
            ":not(.protyle-wysiwyg--select):not(.protyle-wysiwyg--hl):not([select-start]):not([select-end])" +
            ':not([class*="dragover"])::after';
        rules.push(
            `${selector}{content:"${escapeCssString(number)}";` +
                `--siyuan-floating-heading-number-font-size:${sizing.fontSize}px;` +
                `--siyuan-floating-heading-number-width:${sizing.width}px;}`,
        );
    });

    if (gutterHeadingId && snapshot.numberById.has(gutterHeadingId)) {
        rules.push(
            `${hostSelector}[data-siyuan-floating-heading-number-gutter-id="${escapeCssString(gutterHeadingId)}"] ` +
                `[data-node-id="${escapeCssString(gutterHeadingId)}"][data-type="NodeHeading"]::after{opacity:0;}`,
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

function hasHeadingNumberGutter(wysiwyg: HTMLElement): boolean {
    const paddingLeft = Number.parseFloat(wysiwyg.style.paddingLeft || window.getComputedStyle(wysiwyg).paddingLeft);
    return Number.isFinite(paddingLeft) && paddingLeft >= HEADING_NUMBER_MIN_GUTTER;
}

function measureSizing(
    wysiwygRect: DOMRect,
    heading: HTMLElement,
    number: string,
    baseFontSize: number,
    fontFamily: string,
): {fontSize: number; width: number;} {
    const headingRect = heading.getBoundingClientRect();
    const folded = heading.getAttribute("fold") === "1";
    const gap = folded ? HEADING_NUMBER_FOLDED_GAP : HEADING_NUMBER_GAP;
    const minimumWidth = folded ? MIN_FONT_SIZE : MIN_WIDTH;
    let availableWidth = HEADING_NUMBER_MAX_WIDTH;

    if (wysiwygRect.width > 0 && headingRect.width > 0) {
        const reservedWidth = folded ? HEADING_NUMBER_FOLDED_MARKER_WIDTH + gap : gap;
        availableWidth = Math.min(
            HEADING_NUMBER_MAX_WIDTH,
            Math.max(minimumWidth, Math.floor(headingRect.left - wysiwygRect.left - reservedWidth - 1)),
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

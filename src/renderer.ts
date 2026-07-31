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
const measureCanvases = new WeakMap<Document, HTMLCanvasElement>();

interface HeadingTypography {
    fontFamily: string;
    fontSize: number;
    fontStyle: string;
    fontWeight: string;
}

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
    if (
        !enabled || !snapshot || snapshot.rootId !== protyle.block.rootID || !isProtyleSupported(protyle)
    ) {
        clearHeadingNumberRendering(host, styleElement);
        return;
    }
    const view = wysiwyg.ownerDocument.defaultView ?? window;
    const computedStyle = view.getComputedStyle(wysiwyg);
    const effectivePlacement = resolveEffectivePlacement(
        renderPreferences.placement,
        renderPreferences.minimumGutterWidth,
        computedStyle,
    );

    host.dataset.siyuanFloatingHeadingNumberPlugin = controllerId;
    host.dataset.siyuanFloatingHeadingNumberPlacement = effectivePlacement;
    if (gutterHeadingId) {
        host.dataset.siyuanFloatingHeadingNumberGutterId = gutterHeadingId;
    } else {
        delete host.dataset.siyuanFloatingHeadingNumberGutterId;
    }

    const hostSelector = `[data-siyuan-floating-heading-number-plugin="${escapeCssString(controllerId)}"]`;
    const rules: string[] = [];
    const renderedHeadingIds = new Set<string>();
    const wysiwygRect = wysiwyg.getBoundingClientRect();
    const editorTypography: HeadingTypography = {
        fontFamily: computedStyle.fontFamily || "sans-serif",
        fontSize: parseFontSize(computedStyle.fontSize, 16),
        fontStyle: computedStyle.fontStyle || "normal",
        fontWeight: computedStyle.fontWeight || "400",
    };

    wysiwyg.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach((heading) => {
        if (heading.closest(EXCLUDED_HEADING_CONTAINER_SELECTOR)) {
            return;
        }
        const id = heading.getAttribute("data-node-id");
        const number = id ? snapshot.numberById.get(id) : undefined;
        if (!id || !number) {
            return;
        }
        const editable = heading.firstElementChild;
        if (!editable?.hasAttribute("contenteditable")) {
            return;
        }
        const label = `${renderPreferences.prefix}${number}${renderPreferences.suffix}`;
        const headingStyle = view.getComputedStyle(editable);
        const headingTypography: HeadingTypography = {
            fontFamily: headingStyle.fontFamily || editorTypography.fontFamily,
            fontSize: parseFontSize(headingStyle.fontSize, editorTypography.fontSize),
            fontStyle: headingStyle.fontStyle || editorTypography.fontStyle,
            fontWeight: headingStyle.fontWeight || editorTypography.fontWeight,
        };
        const typography = effectivePlacement === "outside-left" || effectivePlacement === "outside-right" ?
            {...headingTypography, fontSize: editorTypography.fontSize} :
            headingTypography;

        const sizing = measureSizing(
            wysiwygRect,
            heading,
            label,
            typography,
            effectivePlacement,
        );
        const selector = `${hostSelector} .protyle-wysiwyg ` +
            `[data-node-id="${escapeCssString(id)}"][data-type="NodeHeading"]`;
        rules.push(
            `${selector}{--siyuan-floating-heading-number-content:"${escapeCssString(label)}";` +
                `--siyuan-floating-heading-number-font-size:${sizing.fontSize}px;` +
                `--siyuan-floating-heading-number-gap:${HEADING_NUMBER_GAP}px;` +
                `--siyuan-floating-heading-number-width:${sizing.width}px;}`,
        );
        if (effectivePlacement === "inside-left" || effectivePlacement === "inside-right") {
            const paddingProperty = effectivePlacement === "inside-left" ? "padding-left" : "padding-right";
            rules.push(
                `${selector}>[contenteditable]:first-child{${paddingProperty}:` +
                    `calc(${sizing.width}px + ${HEADING_NUMBER_GAP}px);}`,
            );
        }
        renderedHeadingIds.add(id);
    });

    const gutterMayOverlapNumber = effectivePlacement === "outside-left" || effectivePlacement === "outside-right";
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

export function resolveEffectivePlacement(
    requestedPlacement: HeadingNumberPlacement,
    minimumGutterWidth: number,
    computedStyle: Pick<CSSStyleDeclaration, "paddingLeft" | "paddingRight">,
): HeadingNumberPlacement {
    if (requestedPlacement !== "outside-left" && requestedPlacement !== "outside-right") {
        return requestedPlacement;
    }
    const paddingValue = requestedPlacement === "outside-left" ? computedStyle.paddingLeft : computedStyle.paddingRight;
    const padding = Number.parseFloat(paddingValue);
    if (Number.isFinite(padding) && padding >= 0 && padding >= minimumGutterWidth) {
        return requestedPlacement;
    }
    return requestedPlacement === "outside-left" ? "inside-left" : "inside-right";
}

function measureSizing(
    wysiwygRect: DOMRect,
    heading: HTMLElement,
    number: string,
    typography: HeadingTypography,
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

    const textWidth = measureText(number, typography, heading.ownerDocument);
    const fontSize = textWidth > availableWidth ?
        Math.max(MIN_FONT_SIZE, Math.floor(typography.fontSize * availableWidth / textWidth * 100) / 100) :
        typography.fontSize;
    const width = textWidth > availableWidth ?
        availableWidth :
        Math.min(availableWidth, Math.max(minimumWidth, Math.ceil(textWidth)));
    return {fontSize, width};
}

function measureText(number: string, typography: HeadingTypography, ownerDocument: Document): number {
    try {
        let measureCanvas = measureCanvases.get(ownerDocument);
        if (!measureCanvas) {
            measureCanvas = ownerDocument.createElement("canvas");
            measureCanvases.set(ownerDocument, measureCanvas);
        }
        const context = measureCanvas.getContext("2d");
        if (context) {
            context.font = `${typography.fontStyle} ${typography.fontWeight} ` +
                `${typography.fontSize}px ${typography.fontFamily}`;
            return context.measureText(number).width;
        }
    } catch {
        // The proportional fallback is used in DOM implementations without a canvas context.
    }
    return number.length * typography.fontSize * 0.6;
}

function parseFontSize(value: string, fallback: number): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

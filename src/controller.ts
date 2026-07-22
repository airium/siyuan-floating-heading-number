import {
    clearHeadingNumberRendering,
    renderHeadingNumbers,
} from "./renderer";
import {DEFAULT_RENDER_PREFERENCES} from "./settings";
import type {
    ControllerRequestToken,
    HeadingNumberRenderPreferences,
    HeadingSnapshot,
    MinimalProtyle,
} from "./types";

let nextControllerId = 0;

export class EditorController {
    readonly id: string;
    readonly host: HTMLElement;

    private protyle: MinimalProtyle;
    private rootIdValue?: string;
    private snapshot?: HeadingSnapshot;
    private enabled = true;
    private renderPreferencesValue: HeadingNumberRenderPreferences;
    private destroyed = false;
    private generation = 0;
    private requestController = new AbortController();
    private resizeObserver?: ResizeObserver;
    private contentObserver?: MutationObserver;
    private gutterObserver?: MutationObserver;
    private gutterElement?: HTMLElement;
    private gutterHeadingId?: string;
    private animationFrame?: number;
    private readonly styleElement: HTMLStyleElement;
    private readonly transitionEndListener = (event: TransitionEvent): void => {
        if (event.propertyName.includes("padding")) {
            this.requestRender();
        }
    };

    constructor(
        protyle: MinimalProtyle,
        enabled = true,
        renderPreferences: HeadingNumberRenderPreferences = DEFAULT_RENDER_PREFERENCES,
    ) {
        this.protyle = protyle;
        this.host = protyle.element;
        this.enabled = enabled;
        this.renderPreferencesValue = {...renderPreferences};
        nextControllerId += 1;
        this.id = `siyuan-floating-heading-number-${nextControllerId}`;
        this.styleElement = this.host.ownerDocument.createElement("style");
        this.styleElement.dataset.siyuanFloatingHeadingNumberStyle = this.id;
        this.host.append(this.styleElement);
        this.bindObservers();
    }

    get rootId(): string | undefined {
        return this.rootIdValue;
    }

    get currentSnapshot(): HeadingSnapshot | undefined {
        return this.snapshot;
    }

    updateProtyle(protyle: MinimalProtyle): void {
        const wysiwygChanged = this.protyle.wysiwyg.element !== protyle.wysiwyg.element;
        const contentChanged = this.protyle.contentElement !== protyle.contentElement;
        if (wysiwygChanged || contentChanged) {
            this.protyle.wysiwyg.element.removeEventListener("transitionend", this.transitionEndListener);
            this.resizeObserver?.disconnect();
            this.contentObserver?.disconnect();
        }
        this.protyle = protyle;
        if (wysiwygChanged || contentChanged) {
            this.bindObservers();
        } else {
            this.bindGutterObserver();
        }
    }

    switchRoot(rootId?: string): void {
        if (this.rootIdValue === rootId) {
            return;
        }
        this.cancelRequest();
        this.rootIdValue = rootId;
        this.snapshot = undefined;
        this.gutterHeadingId = undefined;
        this.render();
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.cancelRequest();
            this.snapshot = undefined;
        }
        this.render();
    }

    setRenderPreferences(renderPreferences: HeadingNumberRenderPreferences): void {
        if (
            this.renderPreferencesValue.placement === renderPreferences.placement &&
            this.renderPreferencesValue.minimumGutterWidth === renderPreferences.minimumGutterWidth &&
            this.renderPreferencesValue.prefix === renderPreferences.prefix &&
            this.renderPreferencesValue.suffix === renderPreferences.suffix
        ) {
            return;
        }
        this.renderPreferencesValue = {...renderPreferences};
        this.render();
    }

    beginRequest(): ControllerRequestToken | undefined {
        if (!this.rootIdValue || this.destroyed) {
            return undefined;
        }
        this.requestController.abort();
        this.requestController = new AbortController();
        this.generation += 1;
        return {
            generation: this.generation,
            rootId: this.rootIdValue,
            signal: this.requestController.signal,
        };
    }

    cancelRequest(): void {
        this.requestController.abort();
        this.requestController = new AbortController();
        this.generation += 1;
    }

    applySnapshot(snapshot: HeadingSnapshot, token?: ControllerRequestToken): boolean {
        if (this.destroyed || !this.host.isConnected || snapshot.rootId !== this.rootIdValue) {
            return false;
        }
        if (
            token && (token.signal.aborted || token.generation !== this.generation || token.rootId !== this.rootIdValue)
        ) {
            return false;
        }
        this.snapshot = snapshot;
        this.render();
        return true;
    }

    clearSnapshot(): void {
        this.snapshot = undefined;
        this.render();
    }

    requestRender(): void {
        if (this.destroyed || this.animationFrame !== undefined) {
            return;
        }
        const view = this.host.ownerDocument.defaultView;
        const schedule = view?.requestAnimationFrame?.bind(view) ??
            ((callback: FrameRequestCallback) => view?.setTimeout(() => callback(Date.now()), 0) as unknown as number);
        this.animationFrame = schedule(() => {
            this.animationFrame = undefined;
            this.render();
        });
    }

    render(): void {
        if (this.destroyed) {
            return;
        }
        renderHeadingNumbers({
            controllerId: this.id,
            enabled: this.enabled,
            gutterHeadingId: this.gutterHeadingId,
            renderPreferences: this.renderPreferencesValue,
            protyle: this.protyle,
            snapshot: this.snapshot,
            styleElement: this.styleElement,
        });
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.requestController.abort();
        this.resizeObserver?.disconnect();
        this.contentObserver?.disconnect();
        this.gutterObserver?.disconnect();
        this.protyle.wysiwyg.element.removeEventListener("transitionend", this.transitionEndListener);
        const view = this.host.ownerDocument.defaultView;
        if (this.animationFrame !== undefined) {
            view?.cancelAnimationFrame?.(this.animationFrame);
        }
        clearHeadingNumberRendering(this.host, this.styleElement);
        this.styleElement.remove();
    }

    private bindObservers(): void {
        const view = this.host.ownerDocument.defaultView;
        if (view?.ResizeObserver) {
            this.resizeObserver = new view.ResizeObserver(() => this.requestRender());
            this.resizeObserver.observe(this.host);
            this.resizeObserver.observe(this.protyle.wysiwyg.element);
            if (this.protyle.contentElement) {
                this.resizeObserver.observe(this.protyle.contentElement);
            }
        }

        this.contentObserver = new MutationObserver((mutations) => {
            if (
                mutations.some((mutation) =>
                    mutation.type === "childList" || mutation.attributeName === "fold" ||
                    mutation.target === this.protyle.wysiwyg.element
                )
            ) {
                this.requestRender();
            }
        });
        this.contentObserver.observe(this.protyle.wysiwyg.element, {
            attributes: true,
            attributeFilter: ["fold", "style"],
            childList: true,
            subtree: true,
        });
        this.protyle.wysiwyg.element.addEventListener("transitionend", this.transitionEndListener);
        this.bindGutterObserver();
    }

    private bindGutterObserver(): void {
        const nextGutter = this.protyle.gutter?.element;
        if (this.gutterElement === nextGutter) {
            this.updateGutterState();
            return;
        }
        this.gutterObserver?.disconnect();
        this.gutterElement = nextGutter;
        if (!nextGutter) {
            this.updateGutterState();
            return;
        }
        this.gutterObserver = new MutationObserver(() => this.updateGutterState());
        this.gutterObserver.observe(nextGutter, {
            attributes: true,
            attributeFilter: ["class", "style"],
            childList: true,
            subtree: true,
        });
        this.updateGutterState();
    }

    private updateGutterState(): void {
        const gutter = this.gutterElement;
        let nextId: string | undefined;
        if (gutter && !gutter.classList.contains("fn__none") && gutter.style.display !== "none") {
            nextId = gutter.querySelector<HTMLElement>(
                'button[data-node-id][data-type="NodeHeading"]',
            )?.dataset.nodeId;
        }
        if (nextId !== this.gutterHeadingId) {
            this.gutterHeadingId = nextId;
            this.requestRender();
        }
    }
}

import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";
import {EditorController} from "../src/controller";
import {escapeCssString} from "../src/renderer";
import type {HeadingNumberPlacement} from "../src/types";
import {
    createProtyle,
    heading,
    snapshot,
} from "./helpers";

describe("EditorController rendering", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("renders generated rules outside the wysiwyg without changing heading HTML", () => {
        const {protyle, host, wysiwyg} = createProtyle({
            headings: heading("first", 1) + heading("second", 2),
        });
        const headings = Array.from(wysiwyg.children).map((element) => element.outerHTML);
        const controller = new EditorController(protyle);
        controller.switchRoot("root");

        expect(controller.applySnapshot(snapshot("root", {first: "1", second: "1.1"}))).toBe(true);
        const style = host.querySelector<HTMLStyleElement>("style[data-siyuan-floating-heading-number-style]");
        expect(style).not.toBeNull();
        expect(wysiwyg.contains(style)).toBe(false);
        expect(style?.textContent).toContain('content:"1"');
        expect(style?.textContent).toContain('content:"1.1"');
        expect(style?.textContent).toContain("--siyuan-floating-heading-number-width:");
        expect(host.dataset.siyuanFloatingHeadingNumberPlacement).toBe("outside-left");
        expect(Array.from(wysiwyg.children).map((element) => element.outerHTML)).toEqual(headings);
    });

    it.each<HeadingNumberPlacement>([
        "outside-left",
        "outside-right",
        "inside-left",
        "inside-right",
        "after-text",
    ])("renders %s without changing heading HTML", (placement) => {
        const {protyle, host, wysiwyg} = createProtyle({headings: heading("placed", 2, "Placed heading")});
        const originalHeading = wysiwyg.firstElementChild?.outerHTML;
        const controller = new EditorController(protyle, true, {placement, minimumGutterWidth: 48});
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {placed: "1.2.3"}));

        const css = host.querySelector("style")?.textContent ?? "";
        expect(host.dataset.siyuanFloatingHeadingNumberPlacement).toBe(placement);
        expect(css).toContain('--siyuan-floating-heading-number-content:"1.2.3"');
        expect(wysiwyg.firstElementChild?.outerHTML).toBe(originalHeading);
        if (placement === "inside-left") {
            expect(css).toContain("padding-left:calc(");
        } else if (placement === "inside-right") {
            expect(css).toContain("padding-right:calc(");
        } else {
            expect(css).not.toContain("padding-left:calc(");
            expect(css).not.toContain("padding-right:calc(");
        }
        controller.destroy();
    });

    it.each(
        [
            ["outside-left", 47, 100, 48, false],
            ["outside-left", 48, 0, 48, true],
            ["outside-right", 100, 47, 48, false],
            ["outside-right", 0, 48, 48, true],
            ["outside-left", 71, 100, 72, false],
            ["outside-right", 100, 72, 72, true],
        ] as const,
    )(
        "%s checks only its corresponding %spx/%spx gutter against %spx",
        (placement, paddingLeft, paddingRight, minimumGutterWidth, visible) => {
            const {protyle, host} = createProtyle({paddingLeft, paddingRight});
            const controller = new EditorController(protyle, true, {placement, minimumGutterWidth});
            controller.switchRoot("root");
            controller.applySnapshot(snapshot("root", {"heading-1": "1"}));

            expect(host.dataset.siyuanFloatingHeadingNumberPlugin !== undefined).toBe(visible);
            controller.destroy();
        },
    );

    it.each<HeadingNumberPlacement>(["inside-left", "inside-right", "after-text"])(
        "%s ignores outside gutter thresholds",
        (placement) => {
            const {protyle, host} = createProtyle({paddingLeft: 0, paddingRight: 0});
            const controller = new EditorController(protyle, true, {placement, minimumGutterWidth: 512});
            controller.switchRoot("root");
            controller.applySnapshot(snapshot("root", {"heading-1": "1"}));

            expect(host.dataset.siyuanFloatingHeadingNumberPlugin).toBeDefined();
            controller.destroy();
        },
    );

    it("recalculates outside visibility after a padding transition", async () => {
        const {protyle, host, wysiwyg} = createProtyle({paddingLeft: 47});
        const controller = new EditorController(protyle);
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {"heading-1": "1"}));
        expect(host.dataset.siyuanFloatingHeadingNumberPlugin).toBeUndefined();

        wysiwyg.style.paddingLeft = "48px";
        const transition = new Event("transitionend") as TransitionEvent;
        Object.defineProperty(transition, "propertyName", {value: "padding-left"});
        wysiwyg.dispatchEvent(transition);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(host.dataset.siyuanFloatingHeadingNumberPlugin).toBeDefined();
        controller.destroy();
    });

    it("suppresses narrow, history, and backlink Protyles", () => {
        for (
            const options of [
                {paddingLeft: 47},
                {history: true},
                {backlink: true},
            ]
        ) {
            const {protyle, host} = createProtyle(options);
            const controller = new EditorController(protyle);
            controller.switchRoot("root");
            controller.applySnapshot(snapshot("root", {"heading-1": "1"}));

            expect(host.dataset.siyuanFloatingHeadingNumberPlugin).toBeUndefined();
            expect(host.querySelector("style")?.textContent).toBe("");
            controller.destroy();
            host.remove();
        }
    });

    it("suppresses headings in live list DOM even when a cached snapshot still numbers them", () => {
        const listHeading = heading("in-list", 2);
        const {protyle, host, wysiwyg} = createProtyle({
            headings: '<div data-node-id="list" data-type="NodeList">' +
                `<div data-node-id="item" data-type="NodeListItem">${listHeading}</div>` +
                "</div>" +
                heading("outside-list", 2),
        });
        const originalListHeading = wysiwyg.querySelector('[data-node-id="in-list"]')?.outerHTML;
        const controller = new EditorController(protyle);
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {"in-list": "1", "outside-list": "2"}));

        const css = host.querySelector("style")?.textContent ?? "";
        expect(css).not.toContain('data-node-id="in-list"');
        expect(css).toContain('data-node-id="outside-list"');
        expect(css).toContain('content:"2"');
        expect(wysiwyg.querySelector('[data-node-id="in-list"]')?.outerHTML).toBe(originalListHeading);
    });

    it("reserves folded-arrow space and proportionally shrinks long numbers", () => {
        const {protyle, host, wysiwyg} = createProtyle({
            headings: heading("folded", 1, "Folded", 'fold="1"'),
        });
        Object.defineProperty(wysiwyg, "getBoundingClientRect", {
            value: () => ({left: 0, width: 500, top: 0, right: 500, bottom: 100, height: 100, x: 0, y: 0, toJSON() {}}),
        });
        Object.defineProperty(wysiwyg.firstElementChild, "getBoundingClientRect", {
            value: () => ({left: 24, width: 400, top: 0, right: 424, bottom: 30, height: 30, x: 24, y: 0, toJSON() {}}),
        });
        const controller = new EditorController(protyle);
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {folded: "123.456.789"}));

        const css = host.querySelector("style")?.textContent ?? "";
        expect(css).toContain("--siyuan-floating-heading-number-width:1px");
        expect(css).toMatch(/--siyuan-floating-heading-number-font-size:1px/);
    });

    it("measures outside-right from the heading edge to the right gutter", () => {
        const {protyle, host, wysiwyg} = createProtyle({headings: heading("right", 1)});
        Object.defineProperty(wysiwyg, "getBoundingClientRect", {
            value: () => ({left: 0, width: 500, top: 0, right: 500, bottom: 100, height: 100, x: 0, y: 0, toJSON() {}}),
        });
        Object.defineProperty(wysiwyg.firstElementChild, "getBoundingClientRect", {
            value: () => ({left: 64, width: 376, top: 0, right: 440, bottom: 30, height: 30, x: 64, y: 0, toJSON() {}}),
        });
        const controller = new EditorController(protyle, true, {
            placement: "outside-right",
            minimumGutterWidth: 48,
        });
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {right: "123.456.789"}));

        const css = host.querySelector("style")?.textContent ?? "";
        expect(css).toContain("--siyuan-floating-heading-number-width:51px");
        expect(css).toMatch(/--siyuan-floating-heading-number-font-size:[1-9]/);
    });

    it.each<HeadingNumberPlacement>(["inside-left", "inside-right", "after-text"])(
        "%s caps long numbers at 96px and shrinks their font",
        (placement) => {
            const {protyle, host} = createProtyle({headings: heading("long", 1)});
            const controller = new EditorController(protyle, true, {placement, minimumGutterWidth: 48});
            controller.switchRoot("root");
            controller.applySnapshot(snapshot("root", {long: "123.456.789.123.456.789"}));

            const css = host.querySelector("style")?.textContent ?? "";
            expect(css).toContain("--siyuan-floating-heading-number-width:96px");
            expect(css).not.toContain("--siyuan-floating-heading-number-font-size:16px");
            controller.destroy();
        },
    );

    it("switches placement with the current snapshot and without replacing heading DOM", () => {
        const {protyle, host, wysiwyg} = createProtyle({headings: heading("switch", 1)});
        const controller = new EditorController(protyle);
        controller.switchRoot("root");
        const currentSnapshot = snapshot("root", {switch: "1"});
        controller.applySnapshot(currentSnapshot);
        const originalHeading = wysiwyg.firstElementChild?.outerHTML;

        controller.setRenderPreferences({placement: "inside-right", minimumGutterWidth: 48});

        expect(controller.currentSnapshot).toBe(currentSnapshot);
        expect(host.dataset.siyuanFloatingHeadingNumberPlacement).toBe("inside-right");
        expect(host.querySelector("style")?.textContent).toContain("padding-right:calc(");
        expect(wysiwyg.firstElementChild?.outerHTML).toBe(originalHeading);
    });

    it("escapes selector IDs and generated content", () => {
        const id = 'heading"\\line';
        const {protyle, host} = createProtyle({headings: heading(id, 1)});
        const controller = new EditorController(protyle);
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {[id]: '1"\\2'}));

        const css = host.querySelector("style")?.textContent ?? "";
        expect(css).toContain(escapeCssString(id));
        expect(css).toContain(escapeCssString('1"\\2'));
    });

    it("tracks gutter activity on host state and cleans up completely", async () => {
        const {protyle, host, wysiwyg, gutter} = createProtyle({headings: heading("active", 1)});
        const originalHeading = wysiwyg.firstElementChild?.outerHTML;
        const controller = new EditorController(protyle);
        controller.switchRoot("root");
        controller.applySnapshot(snapshot("root", {active: "1"}));

        gutter.classList.remove("fn__none");
        gutter.innerHTML = '<button data-node-id="active" data-type="NodeHeading"></button>';
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(host.dataset.siyuanFloatingHeadingNumberGutterId).toBe("active");
        expect(host.querySelector("style")?.textContent).toContain("opacity:0");
        controller.destroy();
        expect(host.dataset.siyuanFloatingHeadingNumberPlugin).toBeUndefined();
        expect(host.dataset.siyuanFloatingHeadingNumberGutterId).toBeUndefined();
        expect(host.dataset.siyuanFloatingHeadingNumberPlacement).toBeUndefined();
        expect(host.querySelector("style[data-siyuan-floating-heading-number-style]")).toBeNull();
        expect(wysiwyg.firstElementChild?.outerHTML).toBe(originalHeading);
    });

    it.each<HeadingNumberPlacement>(["inside-left", "inside-right", "after-text"])(
        "keeps %s visible when SiYuan activates its heading gutter on hover",
        async (placement) => {
            const {protyle, host, gutter} = createProtyle({headings: heading("active", 1)});
            const controller = new EditorController(protyle, true, {placement, minimumGutterWidth: 48});
            controller.switchRoot("root");
            controller.applySnapshot(snapshot("root", {active: "1"}));

            gutter.classList.remove("fn__none");
            gutter.innerHTML = '<button data-node-id="active" data-type="NodeHeading"></button>';
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(host.dataset.siyuanFloatingHeadingNumberGutterId).toBe("active");
            expect(host.querySelector("style")?.textContent).not.toContain(
                "--siyuan-floating-heading-number-opacity:0",
            );
            controller.destroy();
        },
    );

    it("rejects stale root responses and detached editors", () => {
        const first = createProtyle({rootId: "root-a"});
        const controller = new EditorController(first.protyle);
        controller.switchRoot("root-a");
        const token = controller.beginRequest();
        controller.switchRoot("root-b");

        expect(token && controller.applySnapshot(snapshot("root-a", {"heading-1": "1"}), token)).toBe(false);
        first.host.remove();
        expect(controller.applySnapshot(snapshot("root-b", {"heading-1": "1"}))).toBe(false);
    });
});

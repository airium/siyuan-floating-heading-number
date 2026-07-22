import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";
import {EditorController} from "../src/controller";
import {escapeCssString} from "../src/renderer";
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
        expect(Array.from(wysiwyg.children).map((element) => element.outerHTML)).toEqual(headings);
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
        expect(host.querySelector("style[data-siyuan-floating-heading-number-style]")).toBeNull();
        expect(wysiwyg.firstElementChild?.outerHTML).toBe(originalHeading);
    });

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

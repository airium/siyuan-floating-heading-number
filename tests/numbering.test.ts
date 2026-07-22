import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";
import {parseHeadingSnapshot} from "../src/numbering";
import {
    documentDom,
    heading,
    mapObject,
    paragraph,
} from "./helpers";

describe("parseHeadingSnapshot", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("uses the highest heading level present as the root", () => {
        const result = parseHeadingSnapshot(
            "root",
            documentDom(
                heading("h3-a", 3) + heading("h4-a", 4) + heading("h3-b", 3),
            ),
        );

        expect(result.minimumLevel).toBe(3);
        expect(mapObject(result.numberById)).toEqual({
            "h3-a": "1",
            "h4-a": "1.1",
            "h3-b": "2",
        });
    });

    it("emits zero placeholders for skipped levels and resets deeper counters", () => {
        const result = parseHeadingSnapshot(
            "root",
            documentDom(
                heading("early-h4", 4) +
                    heading("h2-a", 2) +
                    heading("h4-a", 4) +
                    heading("h3-a", 3) +
                    heading("h4-b", 4) +
                    heading("h2-b", 2) +
                    heading("h4-c", 4),
            ),
        );

        expect(mapObject(result.numberById)).toEqual({
            "early-h4": "0.0.1",
            "h2-a": "1",
            "h4-a": "1.0.1",
            "h3-a": "1.1",
            "h4-b": "1.1.1",
            "h2-b": "2",
            "h4-c": "2.0.1",
        });
    });

    it("returns an empty numbering map for documents without headings", () => {
        const result = parseHeadingSnapshot("root", documentDom(paragraph("p1")));

        expect(result.minimumLevel).toBeNull();
        expect(result.numberById.size).toBe(0);
        expect(result.allHeadingIds.size).toBe(0);
    });

    it("tracks malformed headings without numbering them", () => {
        const result = parseHeadingSnapshot(
            "root",
            documentDom(
                '<div data-node-id="bad-a" data-type="NodeHeading" data-subtype="h7">Bad</div>' +
                    '<div data-node-id="bad-b" data-type="NodeHeading">Bad</div>' +
                    heading("good", 2),
            ),
        );

        expect(result.allHeadingIds).toEqual(new Set(["bad-a", "bad-b", "good"]));
        expect(result.levelById).toEqual(new Map([["good", 2]]));
        expect(mapObject(result.numberById)).toEqual({good: "1"});
    });

    it.each([
        "NodeBlockquote",
        "NodeCallout",
        "NodeBlockQueryEmbed",
        "NodeList",
        "NodeListItem",
    ])("excludes direct and nested headings under %s", (containerType) => {
        const dom = documentDom(
            `<div data-node-id="container" data-type="${containerType}">` +
                heading("excluded-direct", 2) +
                `<div data-node-id="nested" data-type="NodeSuperBlock">${heading("excluded-nested", 3)}</div>` +
                "</div>" +
                heading("included", 2),
        );
        const result = parseHeadingSnapshot("root", dom);

        expect(mapObject(result.numberById)).toEqual({included: "1"});
        expect(result.allHeadingIds).toEqual(new Set(["excluded-direct", "excluded-nested", "included"]));
        expect(result.headingAncestorIds).toEqual(new Set(["root", "container", "nested"]));
    });

    it.each([
        ["ordered", "o"],
        ["unordered", "u"],
        ["task", "t"],
    ])("excludes headings in %s lists without affecting roots or counters", (_name, subtype) => {
        const result = parseHeadingSnapshot(
            "root",
            documentDom(
                heading("included-root", 3) +
                    `<div data-node-id="list" data-type="NodeList" data-subtype="${subtype}">` +
                    '<div data-node-id="item" data-type="NodeListItem">' +
                    heading("excluded-root", 1) +
                    `<div data-node-id="nested" data-type="NodeSuperBlock">${heading("excluded-deep", 6)}</div>` +
                    "</div>" +
                    "</div>" +
                    heading("included-child", 4),
            ),
        );

        expect(result.minimumLevel).toBe(3);
        expect(mapObject(result.numberById)).toEqual({
            "included-root": "1",
            "included-child": "1.1",
        });
        expect(result.allHeadingIds).toEqual(
            new Set(["included-root", "excluded-root", "excluded-deep", "included-child"]),
        );
        expect(result.headingAncestorIds).toEqual(new Set(["root", "list", "item", "nested"]));
    });

    it("returns an empty numbering map when every heading is inside a list", () => {
        const result = parseHeadingSnapshot(
            "root",
            documentDom(
                '<div data-node-id="list" data-type="NodeList">' +
                    `<div data-node-id="item" data-type="NodeListItem">${heading("excluded", 2)}</div>` +
                    "</div>",
            ),
        );

        expect(result.minimumLevel).toBeNull();
        expect(result.numberById.size).toBe(0);
        expect(result.allHeadingIds).toEqual(new Set(["excluded"]));
    });

    it("excludes descendants when excluded containers are nested in ordinary containers", () => {
        const result = parseHeadingSnapshot(
            "root",
            documentDom(
                '<div data-node-id="outer" data-type="NodeSuperBlock">' +
                    '<div data-node-id="quote" data-type="NodeBlockquote">' +
                    `<div data-node-id="inner" data-type="NodeList">${heading("excluded", 4)}</div>` +
                    "</div>" +
                    "</div>" +
                    heading("included", 4),
            ),
        );

        expect(mapObject(result.numberById)).toEqual({included: "1"});
        expect(result.headingAncestorIds).toEqual(new Set(["root", "outer", "quote", "inner"]));
    });
});

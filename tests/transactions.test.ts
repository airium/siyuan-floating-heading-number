import {
    describe,
    expect,
    it,
} from "vitest";
import {parseHeadingSnapshot} from "../src/numbering";
import {
    operationMayChangeHeadingNumbers,
    operationsMayChangeHeadingNumbers,
    transactionMayChangeHeadingNumbers,
} from "../src/transactions";
import {
    documentDom,
    heading,
    paragraph,
} from "./helpers";

const source = documentDom(
    heading("heading", 2) +
        '<div data-node-id="container" data-type="NodeSuperBlock">' + heading("nested-heading", 3) + "</div>" +
        '<div data-node-id="quote" data-type="NodeBlockquote">' + heading("excluded-heading", 3) + "</div>" +
        paragraph("paragraph"),
);
const snapshot = parseHeadingSnapshot("root", source);

describe("operationMayChangeHeadingNumbers", () => {
    it.each(["insert", "appendInsert", "prependInsert"])("classifies heading-bearing %s operations", (action) => {
        expect(operationMayChangeHeadingNumbers({action, data: heading("new-heading", 2)}, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({action, data: paragraph("new-paragraph")}, snapshot)).toBe(false);
        expect(operationMayChangeHeadingNumbers({action}, snapshot)).toBe(true);
    });

    it.each(["delete", "move", "append"])("refreshes %s only for cached headings or ancestors", (action) => {
        expect(operationMayChangeHeadingNumbers({action, id: "heading"}, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({action, id: "excluded-heading"}, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({action, id: "container"}, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({action, id: "paragraph"}, snapshot)).toBe(false);
        expect(operationMayChangeHeadingNumbers({action}, snapshot)).toBe(true);
    });

    it("always refreshes outline heading moves", () => {
        expect(operationMayChangeHeadingNumbers({action: "moveOutlineHeading", id: "paragraph"}, snapshot)).toBe(true);
    });

    it("ignores same-level heading text updates", () => {
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "heading",
            data: heading("heading", 2, "Renamed"),
        }, snapshot)).toBe(false);
    });

    it("refreshes heading level changes and heading conversions", () => {
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "heading",
            data: heading("heading", 3),
        }, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "heading",
            data: paragraph("heading"),
        }, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "paragraph",
            data: heading("paragraph", 2),
        }, snapshot)).toBe(true);
    });

    it("refreshes heading-bearing and previously heading-bearing container updates", () => {
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "container",
            data: paragraph("container"),
        }, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "paragraph",
            data: `<div data-node-id="paragraph" data-type="NodeBlockquote">${heading("added", 3)}</div>`,
        }, snapshot)).toBe(true);
    });

    it("treats incomplete updates conservatively and ignores irrelevant paragraph edits", () => {
        expect(operationMayChangeHeadingNumbers({action: "update", id: "paragraph"}, snapshot)).toBe(true);
        expect(operationMayChangeHeadingNumbers({
            action: "update",
            id: "paragraph",
            data: paragraph("paragraph", "Edited"),
        }, snapshot)).toBe(false);
    });

    it("handles undo and redo shaped operation batches", () => {
        const replay = [
            {action: "insert", id: "restored", data: heading("restored", 3)},
            {action: "delete", id: "paragraph"},
        ];
        expect(operationsMayChangeHeadingNumbers(replay, snapshot)).toBe(true);
    });

    it("does not refresh for folded-state and unrelated attribute operations", () => {
        expect(operationsMayChangeHeadingNumbers([
            {action: "foldHeading", id: "heading"},
            {action: "setAttrs", id: "paragraph", data: {foo: "bar"}},
        ], snapshot)).toBe(false);
    });

    it("refreshes an open destination for cross-root moves from an uncached source", () => {
        expect(transactionMayChangeHeadingNumbers({
            operations: [{action: "move", id: "heading-from-closed-root"}],
            snapshots: [snapshot],
            incomplete: false,
            affectedRootCount: 2,
        })).toBe(true);
    });

    it("refreshes conservatively when root metadata or a root snapshot is missing", () => {
        const paragraphUpdate = [{action: "update", id: "paragraph", data: paragraph("paragraph", "Edited")}];
        expect(transactionMayChangeHeadingNumbers({
            operations: paragraphUpdate,
            snapshots: [snapshot],
            incomplete: true,
            affectedRootCount: 1,
        })).toBe(true);
        expect(transactionMayChangeHeadingNumbers({
            operations: paragraphUpdate,
            snapshots: [undefined],
            incomplete: false,
            affectedRootCount: 1,
        })).toBe(true);
        expect(transactionMayChangeHeadingNumbers({
            operations: paragraphUpdate,
            snapshots: [snapshot],
            incomplete: false,
            affectedRootCount: 1,
        })).toBe(false);
    });
});

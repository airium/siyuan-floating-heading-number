import {getHeadingLevel} from "./numbering";
import type {
    HeadingSnapshot,
    TransactionOperation,
} from "./types";

const INSERT_ACTIONS = new Set(["insert", "appendInsert", "prependInsert"]);
const ID_STRUCTURAL_ACTIONS = new Set(["append", "delete", "move"]);
const HEADING_SELECTOR = '[data-node-id][data-type="NodeHeading"]';

interface HtmlHeading {
    id: string;
    level: number | null;
}

interface HtmlInspection {
    headings: HtmlHeading[];
    isEmpty: boolean;
}

function inspectHtml(html: string, ownerDocument: Document): HtmlInspection {
    const template = ownerDocument.createElement("template");
    template.innerHTML = html;
    const headings = Array.from(template.content.querySelectorAll(HEADING_SELECTOR)).map((heading) => ({
        id: heading.getAttribute("data-node-id") ?? "",
        level: getHeadingLevel(heading),
    }));
    return {
        headings,
        isEmpty: template.content.childNodes.length === 0,
    };
}

function operationIds(operation: TransactionOperation): string[] {
    return [operation.id, operation.blockID].filter((id): id is string => typeof id === "string" && id.length > 0);
}

function touchesCachedStructure(operation: TransactionOperation, snapshot: HeadingSnapshot): boolean {
    return operationIds(operation).some((id) => snapshot.allHeadingIds.has(id) || snapshot.headingAncestorIds.has(id));
}

function updateMayChangeHeadings(
    operation: TransactionOperation,
    snapshot: HeadingSnapshot,
    ownerDocument: Document,
): boolean {
    if (typeof operation.data !== "string") {
        return true;
    }

    const inspection = inspectHtml(operation.data, ownerDocument);
    const id = operation.id ?? operation.blockID;
    if (!id) {
        return inspection.headings.length > 0 || inspection.isEmpty;
    }

    if (snapshot.headingAncestorIds.has(id)) {
        return true;
    }

    if (!snapshot.allHeadingIds.has(id)) {
        return inspection.headings.length > 0;
    }

    if (inspection.isEmpty || inspection.headings.length !== 1) {
        return true;
    }

    const updatedHeading = inspection.headings[0];
    const previousLevel = snapshot.levelById.get(id);
    return updatedHeading.id !== id || updatedHeading.level === null || updatedHeading.level !== previousLevel;
}

export function operationMayChangeHeadingNumbers(
    operation: TransactionOperation,
    snapshot: HeadingSnapshot,
    ownerDocument: Document = document,
): boolean {
    const action = operation.action;
    if (!action) {
        return true;
    }
    if (action === "moveOutlineHeading") {
        return true;
    }
    if (INSERT_ACTIONS.has(action)) {
        if (typeof operation.data !== "string") {
            return true;
        }
        return inspectHtml(operation.data, ownerDocument).headings.length > 0;
    }
    if (action === "update") {
        return updateMayChangeHeadings(operation, snapshot, ownerDocument);
    }
    if (ID_STRUCTURAL_ACTIONS.has(action)) {
        return operationIds(operation).length === 0 || touchesCachedStructure(operation, snapshot);
    }
    return false;
}

export function operationsMayChangeHeadingNumbers(
    operations: TransactionOperation[],
    snapshot: HeadingSnapshot,
    ownerDocument: Document = document,
): boolean {
    return operations.some((operation) => operationMayChangeHeadingNumbers(operation, snapshot, ownerDocument));
}

export function transactionMayChangeHeadingNumbers(options: {
    operations: TransactionOperation[];
    snapshots: Array<HeadingSnapshot | undefined>;
    incomplete: boolean;
    affectedRootCount: number;
    ownerDocument?: Document;
}): boolean {
    const {operations, snapshots, incomplete, affectedRootCount, ownerDocument = document} = options;
    if (incomplete || snapshots.some((snapshot) => !snapshot)) {
        return true;
    }
    if (
        affectedRootCount > 1 &&
        operations.some((operation) => ["append", "move", "moveOutlineHeading"].includes(operation.action ?? ""))
    ) {
        return true;
    }
    return snapshots.some((snapshot) =>
        snapshot ? operationsMayChangeHeadingNumbers(operations, snapshot, ownerDocument) : true
    );
}

import type {HeadingSnapshot} from "./types";

const HEADING_SELECTOR = '[data-node-id][data-type="NodeHeading"]';
export const EXCLUDED_HEADING_CONTAINER_SELECTOR = [
    '[data-type="NodeBlockquote"]',
    '[data-type="NodeCallout"]',
    '[data-type="NodeBlockQueryEmbed"]',
    '[data-type="NodeList"]',
    '[data-type="NodeListItem"]',
].join(", ");

interface ParsedHeading {
    id: string;
    level: number;
}

export function getHeadingLevel(element: Element): number | null {
    const match = element.getAttribute("data-subtype")?.match(/^h([1-6])$/);
    return match ? Number.parseInt(match[1], 10) : null;
}

export function parseHeadingSnapshot(rootId: string, dom: string, ownerDocument: Document = document): HeadingSnapshot {
    const template = ownerDocument.createElement("template");
    template.innerHTML = dom;

    const included: ParsedHeading[] = [];
    const levelById = new Map<string, number>();
    const allHeadingIds = new Set<string>();
    const headingAncestorIds = new Set<string>();

    template.content.querySelectorAll(HEADING_SELECTOR).forEach((heading) => {
        const id = heading.getAttribute("data-node-id");
        if (!id) {
            return;
        }

        allHeadingIds.add(id);
        for (let ancestor = heading.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const ancestorId = ancestor.getAttribute("data-node-id");
            if (ancestorId) {
                headingAncestorIds.add(ancestorId);
            }
        }

        const level = getHeadingLevel(heading);
        if (level === null) {
            return;
        }
        levelById.set(id, level);

        if (!heading.closest(EXCLUDED_HEADING_CONTAINER_SELECTOR)) {
            included.push({id, level});
        }
    });

    if (included.length === 0) {
        return {
            rootId,
            numberById: new Map(),
            levelById,
            allHeadingIds,
            headingAncestorIds,
            minimumLevel: null,
        };
    }

    const minimumLevel = Math.min(...included.map(({level}) => level));
    const counters = [0, 0, 0, 0, 0, 0];
    const numberById = new Map<string, string>();

    included.forEach(({id, level}) => {
        const relativeLevel = level - minimumLevel + 1;
        counters[relativeLevel - 1] += 1;
        for (let index = relativeLevel; index < counters.length; index += 1) {
            counters[index] = 0;
        }
        numberById.set(id, counters.slice(0, relativeLevel).join("."));
    });

    return {
        rootId,
        numberById,
        levelById,
        allHeadingIds,
        headingAncestorIds,
        minimumLevel,
    };
}

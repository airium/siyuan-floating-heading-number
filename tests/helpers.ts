import type {
    HeadingSnapshot,
    MinimalProtyle,
} from "../src/types";

export function heading(id: string, level: number, text = id, attributes = ""): string {
    const escapedId = id.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return `<div data-node-id="${escapedId}" data-type="NodeHeading" data-subtype="h${level}" ${attributes}>${text}</div>`;
}

export function paragraph(id: string, text = id): string {
    return `<div data-node-id="${id}" data-type="NodeParagraph"><div contenteditable="true">${text}</div></div>`;
}

export function documentDom(content: string, rootId = "root"): string {
    return `<div data-node-id="${rootId}" data-type="NodeDocument">${content}</div>`;
}

export function mapObject(map: ReadonlyMap<string, string>): Record<string, string> {
    return Object.fromEntries(map.entries());
}

export function createProtyle(options: {
    rootId?: string;
    id?: string;
    headings?: string;
    paddingLeft?: number;
    history?: boolean;
    backlink?: boolean;
} = {}): {protyle: MinimalProtyle; host: HTMLElement; wysiwyg: HTMLElement; gutter: HTMLElement;} {
    const host = document.createElement("div");
    host.className = "protyle";
    const wysiwyg = document.createElement("div");
    wysiwyg.className = "protyle-wysiwyg";
    wysiwyg.style.paddingLeft = `${options.paddingLeft ?? 64}px`;
    wysiwyg.innerHTML = options.headings ?? heading("heading-1", 1);
    const gutter = document.createElement("div");
    gutter.className = "protyle-gutters fn__none";
    host.append(wysiwyg, gutter);
    document.body.append(host);

    return {
        host,
        wysiwyg,
        gutter,
        protyle: {
            id: options.id ?? "protyle-1",
            element: host,
            block: {rootID: options.rootId ?? "root"},
            options: {
                action: options.history ? ["cb-get-history"] : [],
                history: options.history ? {} : undefined,
                backlinkData: options.backlink ? [] : undefined,
            },
            wysiwyg: {element: wysiwyg},
            gutter: {element: gutter},
            contentElement: host,
        },
    };
}

export function snapshot(rootId: string, values: Record<string, string>): HeadingSnapshot {
    return {
        rootId,
        numberById: new Map(Object.entries(values)),
        levelById: new Map(Object.keys(values).map((id) => [id, 1])),
        allHeadingIds: new Set(Object.keys(values)),
        headingAncestorIds: new Set([rootId]),
        minimumLevel: Object.keys(values).length > 0 ? 1 : null,
    };
}

export function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, resolve, reject};
}

export function blockDOMResponse(rootId: string, dom: string): Response {
    return new Response(JSON.stringify({code: 0, data: {id: rootId, dom}}), {
        status: 200,
        headers: {"Content-Type": "application/json"},
    });
}

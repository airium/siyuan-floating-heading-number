import {parseHeadingSnapshot} from "./numbering";
import type {
    BlockDOMResponse,
    HeadingSnapshot,
} from "./types";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type SnapshotParser = (rootId: string, dom: string) => HeadingSnapshot;

interface InFlightRequest {
    controller: AbortController;
    id: number;
    promise: Promise<HeadingSnapshot>;
}

interface RootCache {
    references: number;
    requestId: number;
    snapshot?: HeadingSnapshot;
    inFlight?: InFlightRequest;
}

export class HeadingNumberRequestError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "HeadingNumberRequestError";
    }
}

export class HeadingNumberService {
    private readonly caches = new Map<string, RootCache>();
    private readonly fetcher: FetchLike;
    private readonly parser: SnapshotParser;

    constructor(fetcher: FetchLike = fetch.bind(globalThis), parser: SnapshotParser = parseHeadingSnapshot) {
        this.fetcher = fetcher;
        this.parser = parser;
    }

    retain(rootId: string): void {
        const cache = this.getOrCreate(rootId);
        cache.references += 1;
    }

    release(rootId: string): void {
        const cache = this.caches.get(rootId);
        if (!cache) {
            return;
        }
        cache.references = Math.max(0, cache.references - 1);
        if (cache.references === 0) {
            cache.inFlight?.controller.abort();
            this.caches.delete(rootId);
        }
    }

    peek(rootId: string): HeadingSnapshot | undefined {
        return this.caches.get(rootId)?.snapshot;
    }

    get(rootId: string): Promise<HeadingSnapshot> {
        const cache = this.getOrCreate(rootId);
        if (cache.snapshot) {
            return Promise.resolve(cache.snapshot);
        }
        return cache.inFlight?.promise ?? this.startRequest(rootId, cache);
    }

    refresh(rootId: string): Promise<HeadingSnapshot> {
        const cache = this.getOrCreate(rootId);
        cache.inFlight?.controller.abort();
        return this.startRequest(rootId, cache);
    }

    clear(rootId: string): void {
        const cache = this.caches.get(rootId);
        if (!cache) {
            return;
        }
        cache.inFlight?.controller.abort();
        cache.requestId += 1;
        cache.inFlight = undefined;
        cache.snapshot = undefined;
    }

    dispose(): void {
        this.caches.forEach((cache) => cache.inFlight?.controller.abort());
        this.caches.clear();
    }

    private getOrCreate(rootId: string): RootCache {
        let cache = this.caches.get(rootId);
        if (!cache) {
            cache = {references: 0, requestId: 0};
            this.caches.set(rootId, cache);
        }
        return cache;
    }

    private startRequest(rootId: string, cache: RootCache): Promise<HeadingSnapshot> {
        const controller = new AbortController();
        const requestId = cache.requestId + 1;
        cache.requestId = requestId;

        const promise = this.fetchSnapshot(rootId, controller.signal)
            .then((snapshot) => {
                if (cache.requestId !== requestId) {
                    throw new DOMException("Superseded floating-heading-number response", "AbortError");
                }
                cache.snapshot = snapshot;
                return snapshot;
            })
            .catch((error: unknown) => {
                if (!isAbortError(error) && cache.requestId === requestId) {
                    cache.snapshot = undefined;
                }
                throw error;
            })
            .finally(() => {
                if (cache.inFlight?.id === requestId) {
                    cache.inFlight = undefined;
                }
            });

        cache.inFlight = {controller, id: requestId, promise};
        return promise;
    }

    private async fetchSnapshot(rootId: string, signal: AbortSignal): Promise<HeadingSnapshot> {
        let response: Response;
        try {
            response = await this.fetcher("/api/block/getBlockDOM", {
                method: "POST",
                credentials: "same-origin",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id: rootId}),
                signal,
            });
        } catch (error) {
            if (isAbortError(error)) {
                throw error;
            }
            throw new HeadingNumberRequestError("The BlockDOM request failed", {cause: error});
        }

        if (!response.ok) {
            throw new HeadingNumberRequestError(`The BlockDOM request returned HTTP ${response.status}`);
        }

        let payload: unknown;
        try {
            payload = await response.json();
        } catch (error) {
            throw new HeadingNumberRequestError("The BlockDOM response was not valid JSON", {cause: error});
        }
        if (!isBlockDOMResponse(payload, rootId)) {
            throw new HeadingNumberRequestError("The BlockDOM response did not match the expected contract");
        }

        try {
            return this.parser(rootId, payload.data.dom);
        } catch (error) {
            throw new HeadingNumberRequestError("The BlockDOM response could not be parsed", {cause: error});
        }
    }
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError" ||
        error instanceof Error && error.name === "AbortError";
}

function isBlockDOMResponse(value: unknown, rootId: string): value is BlockDOMResponse {
    if (!value || typeof value !== "object") {
        return false;
    }
    const response = value as Partial<BlockDOMResponse>;
    return response.code === 0 &&
        !!response.data &&
        response.data.id === rootId &&
        typeof response.data.dom === "string";
}

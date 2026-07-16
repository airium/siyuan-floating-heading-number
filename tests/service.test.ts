import {
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    HeadingNumberRequestError,
    HeadingNumberService,
    isAbortError,
} from "../src/service";
import type {FetchLike} from "../src/service";
import {
    blockDOMResponse,
    deferred,
    documentDom,
    heading,
    mapObject,
} from "./helpers";

describe("HeadingNumberService", () => {
    it("deduplicates concurrent requests and shares a root snapshot", async () => {
        const pending = deferred<Response>();
        const fetcher = vi.fn<FetchLike>(() => pending.promise);
        const service = new HeadingNumberService(fetcher);
        service.retain("root");
        service.retain("root");

        const first = service.get("root");
        const second = service.get("root");
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(first).toBe(second);

        pending.resolve(blockDOMResponse("root", documentDom(heading("h1", 1))));
        const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);
        expect(firstSnapshot).toBe(secondSnapshot);
        expect(service.peek("root")).toBe(firstSnapshot);

        service.release("root");
        expect(service.peek("root")).toBe(firstSnapshot);
        service.release("root");
        expect(service.peek("root")).toBeUndefined();
    });

    it("applies only the newest response when the fetcher does not honor abort", async () => {
        const firstPending = deferred<Response>();
        const secondPending = deferred<Response>();
        const fetcher = vi.fn<FetchLike>()
            .mockImplementationOnce(() => firstPending.promise)
            .mockImplementationOnce(() => secondPending.promise);
        const service = new HeadingNumberService(fetcher);

        const first = service.get("root");
        const second = service.refresh("root");
        secondPending.resolve(blockDOMResponse("root", documentDom(heading("new", 1))));
        expect(mapObject((await second).numberById)).toEqual({new: "1"});

        firstPending.resolve(blockDOMResponse("root", documentDom(heading("old", 1))));
        await expect(first).rejects.toSatisfy(isAbortError);
        expect(mapObject(service.peek("root")?.numberById ?? new Map())).toEqual({new: "1"});
    });

    it("keeps the last good snapshot while superseded requests are pending or aborted", async () => {
        const refreshOne = deferred<Response>();
        const refreshTwo = deferred<Response>();
        const fetcher = vi.fn<FetchLike>()
            .mockResolvedValueOnce(blockDOMResponse("root", documentDom(heading("initial", 1))))
            .mockImplementationOnce(() => refreshOne.promise)
            .mockImplementationOnce(() => refreshTwo.promise);
        const service = new HeadingNumberService(fetcher);
        const initial = await service.get("root");

        const superseded = service.refresh("root");
        const current = service.refresh("root");
        expect(service.peek("root")).toBe(initial);

        refreshOne.reject(new DOMException("Aborted", "AbortError"));
        await expect(superseded).rejects.toSatisfy(isAbortError);
        expect(service.peek("root")).toBe(initial);

        refreshTwo.resolve(blockDOMResponse("root", documentDom(heading("current", 1))));
        expect(mapObject((await current).numberById)).toEqual({current: "1"});
    });

    it("clears the cache after malformed responses and API errors", async () => {
        const fetcher = vi.fn<FetchLike>()
            .mockResolvedValueOnce(blockDOMResponse("root", documentDom(heading("initial", 1))))
            .mockResolvedValueOnce(new Response(JSON.stringify({code: 0, data: {id: "other", dom: ""}})))
            .mockResolvedValueOnce(new Response("failure", {status: 500}));
        const service = new HeadingNumberService(fetcher);
        await service.get("root");

        await expect(service.refresh("root")).rejects.toBeInstanceOf(HeadingNumberRequestError);
        expect(service.peek("root")).toBeUndefined();
        await expect(service.refresh("root")).rejects.toBeInstanceOf(HeadingNumberRequestError);
        expect(service.peek("root")).toBeUndefined();
    });

    it("aborts and discards an unreferenced root", async () => {
        const pending = deferred<Response>();
        let signal: AbortSignal | undefined;
        const fetcher: FetchLike = (_input, init) => {
            signal = init?.signal ?? undefined;
            return pending.promise;
        };
        const service = new HeadingNumberService(fetcher);
        service.retain("root");
        const request = service.get("root");
        service.release("root");

        expect(signal?.aborted).toBe(true);
        expect(service.peek("root")).toBeUndefined();
        pending.reject(new DOMException("Aborted", "AbortError"));
        await expect(request).rejects.toSatisfy(isAbortError);
    });

    it("does not repopulate a cleared cache when a fetch ignores abort", async () => {
        const pending = deferred<Response>();
        const service = new HeadingNumberService(() => pending.promise);
        const request = service.get("root");

        service.clear("root");
        pending.resolve(blockDOMResponse("root", documentDom(heading("stale", 1))));

        await expect(request).rejects.toSatisfy(isAbortError);
        expect(service.peek("root")).toBeUndefined();
    });
});

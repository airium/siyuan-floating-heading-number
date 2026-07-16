import {Window} from "happy-dom";
import {performance} from "node:perf_hooks";
import {parseHeadingSnapshot} from "../src/numbering";
import {renderHeadingNumbers} from "../src/renderer";
import type {MinimalProtyle} from "../src/types";

interface BenchmarkResult {
    blocks: number;
    responseBytes: number;
    headings: number;
    parseMilliseconds: number;
    visibleRenderMilliseconds: number;
    generatedRuleBytes: number;
}

const args = parseArguments(process.argv.slice(2));
const window = new Window({url: args.endpoint ?? "http://127.0.0.1:6806"});
Object.assign(globalThis, {
    document: window.document,
    DOMException: window.DOMException,
    HTMLElement: window.HTMLElement,
    MutationObserver: window.MutationObserver,
    window,
});

void main();

async function main(): Promise<void> {
    const results = [10_000, 50_000].map(runGeneratedBenchmark);
    const report: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        runtime: process.version,
        generatedFixtures: results,
    };

    if (args.endpoint && args.rootId) {
        report.liveKernel = await runLiveKernelBenchmark(args.endpoint, args.rootId);
    }

    console.log(JSON.stringify(report, null, 2));
}

function runGeneratedBenchmark(blocks: number): BenchmarkResult {
    const dom = generateDocument(blocks);
    const parseStart = performance.now();
    const snapshot = parseHeadingSnapshot("benchmark-root", dom, window.document as unknown as Document);
    const parseMilliseconds = performance.now() - parseStart;

    const hostNode = window.document.createElement("div");
    const wysiwygNode = window.document.createElement("div");
    const styleNode = window.document.createElement("style");
    const host = hostNode as unknown as HTMLElement;
    const wysiwyg = wysiwygNode as unknown as HTMLElement;
    const style = styleNode as unknown as HTMLStyleElement;
    wysiwyg.className = "protyle-wysiwyg";
    wysiwyg.style.paddingLeft = "64px";
    const visibleHeadingIds = Array.from(snapshot.numberById.keys()).slice(0, 200);
    wysiwyg.innerHTML = visibleHeadingIds.map((id, index) =>
        `<div data-node-id="${id}" data-type="NodeHeading" data-subtype="h${index % 6 + 1}">Heading</div>`
    ).join("");
    host.append(wysiwyg, style);
    window.document.body.append(hostNode);
    const protyle: MinimalProtyle = {
        id: "benchmark-protyle",
        element: host,
        block: {rootID: "benchmark-root"},
        options: {action: []},
        wysiwyg: {element: wysiwyg},
    };

    const renderStart = performance.now();
    renderHeadingNumbers({
        controllerId: "benchmark-controller",
        enabled: true,
        protyle,
        snapshot,
        styleElement: style,
    });
    const visibleRenderMilliseconds = performance.now() - renderStart;
    host.remove();

    return {
        blocks,
        responseBytes: Buffer.byteLength(dom),
        headings: snapshot.numberById.size,
        parseMilliseconds: round(parseMilliseconds),
        visibleRenderMilliseconds: round(visibleRenderMilliseconds),
        generatedRuleBytes: Buffer.byteLength(style.textContent ?? ""),
    };
}

async function runLiveKernelBenchmark(endpoint: string, rootId: string): Promise<Record<string, unknown>> {
    const requestStart = performance.now();
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/block/getBlockDOM`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({id: rootId}),
    });
    const text = await response.text();
    const responseMilliseconds = performance.now() - requestStart;
    if (!response.ok) {
        throw new Error(`Live kernel returned HTTP ${response.status}`);
    }
    const payload = JSON.parse(text) as {code?: number; data?: {id?: string; dom?: string;};};
    if (payload.code !== 0 || payload.data?.id !== rootId || typeof payload.data.dom !== "string") {
        throw new Error("Live kernel returned an invalid BlockDOM response");
    }
    const parseStart = performance.now();
    const snapshot = parseHeadingSnapshot(rootId, payload.data.dom, window.document as unknown as Document);
    return {
        rootId,
        responseBytes: Buffer.byteLength(text),
        responseMilliseconds: round(responseMilliseconds),
        parseMilliseconds: round(performance.now() - parseStart),
        headings: snapshot.numberById.size,
    };
}

function generateDocument(blocks: number): string {
    const content: string[] = ['<div data-node-id="benchmark-root" data-type="NodeDocument">'];
    for (let index = 0; index < blocks; index += 1) {
        const id = `20260716${String(index).padStart(6, "0")}-bench`;
        if (index % 10 === 0) {
            const level = index / 10 % 6 + 1;
            content.push(
                `<div data-node-id="${id}" data-type="NodeHeading" data-subtype="h${level}">Heading ${index}</div>`,
            );
        } else {
            content.push(
                `<div data-node-id="${id}" data-type="NodeParagraph"><div contenteditable="true">Block ${index}</div></div>`,
            );
        }
    }
    content.push("</div>");
    return content.join("");
}

function parseArguments(values: string[]): {endpoint?: string; rootId?: string;} {
    const result: {endpoint?: string; rootId?: string;} = {};
    for (let index = 0; index < values.length; index += 1) {
        if (values[index] === "--endpoint") {
            result.endpoint = values[index + 1];
            index += 1;
        } else if (values[index] === "--root-id") {
            result.rootId = values[index + 1];
            index += 1;
        }
    }
    if (!!result.endpoint !== !!result.rootId) {
        throw new Error("--endpoint and --root-id must be provided together");
    }
    return result;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

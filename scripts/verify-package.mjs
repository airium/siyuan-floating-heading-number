import JSZip from "jszip";
import {readFile} from "node:fs/promises";

const expectedFiles = [
    "CHANGELOG.md",
    "LICENSE",
    "README.md",
    "README.zh-CN.md",
    "i18n/en.json",
    "i18n/zh-CN.json",
    "icon.png",
    "index.css",
    "index.js",
    "plugin.json",
    "preview.png",
];

const zip = await JSZip.loadAsync(await readFile("package.zip"));
const actualFiles = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
const expectedSorted = [...expectedFiles].sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedSorted)) {
    throw new Error(`Unexpected package contents:\n${actualFiles.join("\n")}`);
}

const plugin = JSON.parse(await zip.file("plugin.json").async("string"));
const sourcePlugin = JSON.parse(await readFile("plugin.json", "utf8"));
const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
if (JSON.stringify(plugin) !== JSON.stringify(sourcePlugin)) {
    throw new Error("Packaged plugin.json does not match the repository manifest");
}
if (
    plugin.name !== "siyuan-floating-heading-number" ||
    plugin.name !== packageMetadata.name ||
    plugin.version !== packageMetadata.version ||
    plugin.minAppVersion !== "3.7.1" ||
    plugin.url !== "https://github.com/airium/siyuan-floating-heading-number"
) {
    throw new Error("plugin.json identity or compatibility metadata is invalid");
}
if ("kernels" in plugin || plugin.disabledInPublish !== true || JSON.stringify(plugin.backends) !== '["all"]') {
    throw new Error("plugin.json contains an invalid backend or kernel declaration");
}

await assertPngDimensions(zip, "icon.png", 160, 160);
await assertPngDimensions(zip, "preview.png", 1024, 768);
console.log(`Verified package.zip (${actualFiles.length} files)`);

async function assertPngDimensions(archive, name, width, height) {
    const bytes = await archive.file(name).async("uint8array");
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((value, index) => bytes[index] === value)) {
        throw new Error(`${name} is not a PNG file`);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16) !== width || view.getUint32(20) !== height) {
        throw new Error(`${name} must be ${width}x${height}`);
    }
}

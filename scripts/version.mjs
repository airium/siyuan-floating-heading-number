import {
    readFile,
    writeFile,
} from "node:fs/promises";

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const [command, requestedVersion, ...extraArguments] = process.argv.slice(2);

if (!command || extraArguments.length > 0 || !["check", "set"].includes(command)) {
    fail("Usage: node scripts/version.mjs <check [version] | set version>");
}
if (command === "set" && !requestedVersion) {
    fail("A version is required when setting the release version");
}
if (requestedVersion && !versionPattern.test(requestedVersion)) {
    fail(`Version must use stable MAJOR.MINOR.PATCH syntax: ${requestedVersion}`);
}

const plugin = await readJson("plugin.json");
const packageMetadata = await readJson("package.json");

if (command === "check") {
    if (!versionPattern.test(plugin.version)) {
        fail(`plugin.json contains an invalid stable version: ${plugin.version}`);
    }
    if (plugin.version !== packageMetadata.version) {
        fail(`Version mismatch: plugin.json=${plugin.version}, package.json=${packageMetadata.version}`);
    }
    if (requestedVersion && plugin.version !== requestedVersion) {
        fail(`Release input ${requestedVersion} does not match plugin.json ${plugin.version}`);
    }
    console.log(`Verified version ${plugin.version}`);
} else {
    plugin.version = requestedVersion;
    packageMetadata.version = requestedVersion;
    await Promise.all([
        writeJson("plugin.json", plugin),
        writeJson("package.json", packageMetadata),
    ]);
    console.log(`Set plugin.json and package.json to ${requestedVersion}`);
}

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

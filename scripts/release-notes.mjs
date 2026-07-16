import {readFile} from "node:fs/promises";

const [version, ...extraArguments] = process.argv.slice(2);
if (!version || extraArguments.length > 0 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    fail("Usage: node scripts/release-notes.mjs <MAJOR.MINOR.PATCH>");
}

const changelog = await readFile("CHANGELOG.md", "utf8");
const escapedVersion = version.replaceAll(".", "\\.");
const headingPattern = new RegExp(`^## v${escapedVersion}(?:\\s+-\\s+.+)?\\s*$`, "m");
const heading = headingPattern.exec(changelog);
if (!heading) {
    fail(`CHANGELOG.md has no section for v${version}`);
}

const sectionStart = heading.index + heading[0].length;
const remaining = changelog.slice(sectionStart);
const nextHeading = remaining.search(/^##\s+/m);
const notes = remaining.slice(0, nextHeading === -1 ? undefined : nextHeading).trim();
if (!notes) {
    fail(`CHANGELOG.md section v${version} has no release notes`);
}

process.stdout.write(`${notes}\n`);

function fail(message) {
    console.error(message);
    process.exit(1);
}

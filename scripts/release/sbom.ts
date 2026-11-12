// Write a CycloneDX 1.5 SBOM of the panel's runtime dependencies.
//
// Usage: bun scripts/release/sbom.ts <bun.lock> <package.json> <output.json>
//
// The document is made from the lockfile alone, by this script. No package is
// installed and no third-party tool runs, so the job that makes it executes no
// code it did not take from the verified commit. Only what the panel needs at
// run time is listed: the walk starts at the workspace's `dependencies` and
// `optionalDependencies` and follows each package's own, so build and test
// tooling (`devDependencies`) stays out. That is a superset of what the image
// and the .deb carry, because Next.js traces only the files it uses.
//
// Anything the script cannot place (a package that is not a registry release,
// a dependency that resolves to nothing) stops it: an SBOM that quietly drops
// an entry is worse than none.

type Deps = Record<string, string>;
type Entry = [spec: string, registry: string, meta: Record<string, Deps>, integrity?: string];
type Lock = {
	workspaces: Record<string, { dependencies?: Deps; optionalDependencies?: Deps }>;
	packages: Record<string, Entry>;
};

const [lockPath, manifestPath, outPath] = Bun.argv.slice(2);
if (!lockPath || !manifestPath || !outPath) {
	console.error("usage: sbom.ts <bun.lock> <package.json> <output.json>");
	process.exit(2);
}

function fail(message: string): never {
	console.error(`::error::${message}`);
	process.exit(1);
}

const lock = Bun.JSONC.parse(await Bun.file(lockPath).text()) as Lock;
const manifest = (await Bun.file(manifestPath).json()) as { name: string; version: string };
const root = lock.workspaces[""];
if (!root || !lock.packages) fail(`${lockPath} has no root workspace or no packages`);

/** Resolve `dep` as seen from the package stored under `parent`, the way bun
 * lays it out: a copy nested under the parent wins over one further up. */
function resolve(parent: string, dep: string): string | undefined {
	const segments = parent === "" ? [] : parent.split("/");
	// A scoped name is two path segments, so merge them back before walking up.
	const parts: string[] = [];
	for (const s of segments) {
		if (parts.length > 0 && parts[parts.length - 1].startsWith("@") && !parts[parts.length - 1].includes("/")) {
			parts[parts.length - 1] += `/${s}`;
		} else parts.push(s);
	}
	for (let n = parts.length; n >= 0; n--) {
		const key = [...parts.slice(0, n), dep].join("/");
		if (key in lock.packages) return key;
	}
	return undefined;
}

function split(spec: string): { name: string; version: string } {
	const at = spec.lastIndexOf("@");
	return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

const reachable = new Map<string, string[]>();
const queue: Array<[parent: string, deps: Deps, optional: boolean]> = [
	["", root.dependencies ?? {}, false],
	["", root.optionalDependencies ?? {}, true],
];
while (queue.length > 0) {
	const [parent, deps, optional] = queue.pop() as (typeof queue)[number];
	for (const dep of Object.keys(deps)) {
		const key = resolve(parent, dep);
		if (key === undefined) {
			if (optional) continue;
			fail(`${dep}, required by ${parent || "the workspace"}, is not in ${lockPath}`);
		}
		if (parent !== "") reachable.get(parent)?.push(key);
		if (reachable.has(key)) continue;
		reachable.set(key, []);
		const meta = lock.packages[key][2] ?? {};
		queue.push([key, meta.dependencies ?? {}, false]);
		queue.push([key, meta.optionalDependencies ?? {}, true]);
		queue.push([key, meta.peerDependencies ?? {}, true]);
	}
}

function purl(key: string): string {
	const { name, version } = split(lock.packages[key][0]);
	if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.+-]+)?$/.test(version)) {
		fail(`${key} is ${lock.packages[key][0]}, not a registry release; the SBOM cannot place it`);
	}
	// The purl spec writes the scope's `@` as %40.
	return `pkg:npm/${name.replace(/^@/, "%40")}@${version}`;
}

const components = [...reachable.keys()].sort().map((key) => {
	const { name, version } = split(lock.packages[key][0]);
	const integrity = lock.packages[key][3];
	const component: Record<string, unknown> = { type: "library", "bom-ref": purl(key), name, version, purl: purl(key) };
	const m = /^sha512-(.+)$/.exec(integrity ?? "");
	if (m) component.hashes = [{ alg: "SHA-512", content: Buffer.from(m[1], "base64").toString("hex") }];
	return component;
});

const rootRef = `pkg:npm/${manifest.name}@${manifest.version}`;
const direct = [...Object.keys(root.dependencies ?? {}), ...Object.keys(root.optionalDependencies ?? {})]
	.map((d) => resolve("", d))
	.filter((k): k is string => k !== undefined)
	.map(purl);
const dependencies = [
	{ ref: rootRef, dependsOn: [...new Set(direct)].sort() },
	...[...reachable.entries()].sort().map(([key, deps]) => ({ ref: purl(key), dependsOn: [...new Set(deps.map(purl))].sort() })),
];

const bom = {
	bomFormat: "CycloneDX",
	specVersion: "1.5",
	version: 1,
	metadata: { component: { type: "application", "bom-ref": rootRef, name: manifest.name, version: manifest.version, purl: rootRef } },
	components,
	dependencies,
};
if (components.length === 0) fail("the SBOM has no components");
await Bun.write(outPath, `${JSON.stringify(bom, null, 2)}\n`);
console.log(`${outPath}: ${components.length} components`);

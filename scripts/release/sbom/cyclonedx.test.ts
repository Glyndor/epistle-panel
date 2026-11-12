import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "cyclonedx.ts");
const repo = join(import.meta.dir, "..", "..", "..");

// Made when the file loads: the `describe` blocks below run the script while
// bun collects them, before any `beforeAll` hook would.
const dir = mkdtempSync(join(tmpdir(), "cyclonedx-"));
afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

type Bom = {
	bomFormat: string;
	specVersion: string;
	metadata: { component: { name: string; version: string; "bom-ref": string } };
	components: Array<{ name: string; version: string; purl: string; hashes?: Array<{ alg: string; content: string }> }>;
	dependencies: Array<{ ref: string; dependsOn: string[] }>;
};

/** Run the script over a lockfile text; return the exit status, stderr and the document. */
function generate(lock: string, manifest = { name: "panel", version: "1.2.3" }, tag = "case") {
	const lockPath = join(dir, `${tag}.lock`);
	const manifestPath = join(dir, `${tag}.json`);
	const outPath = join(dir, `${tag}.out.json`);
	writeFileSync(lockPath, lock);
	writeFileSync(manifestPath, JSON.stringify(manifest));
	const result = Bun.spawnSync(["bun", script, lockPath, manifestPath, outPath], { stdout: "pipe", stderr: "pipe" });
	let bom: Bom | undefined;
	if (result.exitCode === 0) bom = JSON.parse(readFileSync(outPath, "utf8")) as Bom;
	return { status: result.exitCode, stderr: result.stderr.toString(), bom };
}

const sha = Buffer.from("abcdef", "hex").toString("base64");
/** A lockfile with `dependencies` and `devDependencies` at the root and `packages` as given. */
function lockfile(packages: Record<string, unknown>, root: Record<string, unknown>): string {
	return JSON.stringify({ lockfileVersion: 1, workspaces: { "": { name: "panel", ...root } }, packages }, null, "\t");
}

describe("the document", () => {
	const lock = lockfile(
		{
			a: ["a@1.0.0", "", { dependencies: { b: "^2.0.0" } }, `sha512-${sha}`],
			b: ["b@2.1.0", "", {}, "sha512-AAAA"],
			"@scope/c": ["@scope/c@3.0.0-beta.1", "", {}],
			dev: ["dev@9.9.9", "", { dependencies: { b: "^2.0.0" } }],
		},
		{ dependencies: { a: "^1.0.0", "@scope/c": "^3.0.0-beta.1" }, devDependencies: { dev: "^9.0.0" } },
	);
	const { status, bom } = generate(lock);

	test("is a CycloneDX 1.5 document naming the application", () => {
		expect(status).toBe(0);
		expect(bom?.bomFormat).toBe("CycloneDX");
		expect(bom?.specVersion).toBe("1.5");
		expect(bom?.metadata.component["bom-ref"]).toBe("pkg:npm/panel@1.2.3");
	});

	test("lists runtime packages and leaves development ones out", () => {
		expect(bom?.components.map((c) => c.name)).toEqual(["@scope/c", "a", "b"]);
	});

	test("writes the scope of a package as %40 in its purl", () => {
		expect(bom?.components[0].purl).toBe("pkg:npm/%40scope/c@3.0.0-beta.1");
	});

	test("carries the integrity as a SHA-512 hash in hex", () => {
		const a = bom?.components.find((c) => c.name === "a");
		expect(a?.hashes).toEqual([{ alg: "SHA-512", content: "abcdef" }]);
		expect(bom?.components.find((c) => c.name === "@scope/c")?.hashes).toBeUndefined();
	});

	test("records who depends on whom, the application on its direct dependencies", () => {
		const edges = Object.fromEntries((bom?.dependencies ?? []).map((d) => [d.ref, d.dependsOn]));
		expect(edges["pkg:npm/panel@1.2.3"]).toEqual(["pkg:npm/%40scope/c@3.0.0-beta.1", "pkg:npm/a@1.0.0"]);
		expect(edges["pkg:npm/a@1.0.0"]).toEqual(["pkg:npm/b@2.1.0"]);
	});
});

describe("resolution", () => {
	test("a copy nested under the parent wins over one further up", () => {
		const { status, bom } = generate(
			lockfile(
				{
					a: ["a@1.0.0", "", { dependencies: { b: "^1.0.0" } }],
					"a/b": ["b@1.5.0", "", {}],
					b: ["b@2.0.0", "", {}],
				},
				{ dependencies: { a: "^1.0.0", b: "^2.0.0" } },
			),
			undefined,
			"nested",
		);
		expect(status).toBe(0);
		const edges = Object.fromEntries((bom?.dependencies ?? []).map((d) => [d.ref, d.dependsOn]));
		expect(edges["pkg:npm/a@1.0.0"]).toEqual(["pkg:npm/b@1.5.0"]);
	});

	test("an optional dependency that is not installed is skipped", () => {
		const { status, bom } = generate(
			lockfile({ a: ["a@1.0.0", "", { optionalDependencies: { gone: "^1.0.0" } }] }, { dependencies: { a: "^1.0.0" } }),
			undefined,
			"optional",
		);
		expect(status).toBe(0);
		expect(bom?.components.map((c) => c.name)).toEqual(["a"]);
	});
});

describe("what stops the script", () => {
	test("a required dependency missing from the lockfile", () => {
		const { status, stderr } = generate(
			lockfile({ a: ["a@1.0.0", "", { dependencies: { gone: "^1.0.0" } }] }, { dependencies: { a: "^1.0.0" } }),
			undefined,
			"missing",
		);
		expect(status).toBe(1);
		expect(stderr).toContain("gone");
	});

	test("a package that is not a registry release", () => {
		const { status, stderr } = generate(
			lockfile({ a: ["a@github:owner/a#abc123", "", {}] }, { dependencies: { a: "github:owner/a" } }),
			undefined,
			"git",
		);
		expect(status).toBe(1);
		expect(stderr).toContain("not a registry release");
	});

	test("a lockfile with no runtime dependencies", () => {
		const { status, stderr } = generate(
			lockfile({ dev: ["dev@1.0.0", "", {}] }, { devDependencies: { dev: "^1.0.0" } }),
			undefined,
			"empty",
		);
		expect(status).toBe(1);
		expect(stderr).toContain("no components");
	});

	test("a lockfile without packages", () => {
		const { status } = generate(`{ "workspaces": { "": { "name": "panel" } } }`, undefined, "nopackages");
		expect(status).toBe(1);
	});

	test("missing arguments", () => {
		const result = Bun.spawnSync(["bun", script], { stdout: "pipe", stderr: "pipe" });
		expect(result.exitCode).toBe(2);
	});
});

describe("the repository lockfile", () => {
	const lock = readFileSync(join(repo, "internal", "bun.lock"), "utf8");
	const manifest = JSON.parse(readFileSync(join(repo, "internal", "package.json"), "utf8")) as {
		name: string;
		version: string;
		devDependencies: Record<string, string>;
		dependencies: Record<string, string>;
	};
	const { status, bom } = generate(lock, manifest, "repo");

	test("produces a document with every runtime dependency and no development tool", () => {
		expect(status).toBe(0);
		const names = new Set(bom?.components.map((c) => c.name));
		for (const name of Object.keys(manifest.dependencies)) expect(names.has(name)).toBe(true);
		for (const name of ["@biomejs/biome", "typescript"]) expect(names.has(name)).toBe(false);
	});
});

import { describe, expect, it } from "bun:test";

import { Suspense } from "react";

import { firstPaint, resolveFirstPaint, resolveServerTree } from ".";

async function Greeting({ name }: { name: string }) {
	return <p>{`hello ${name}`}</p>;
}

function Wrapper({ children }: { children?: React.ReactNode }) {
	return <section>{children}</section>;
}

describe("resolveServerTree", () => {
	it("replaces an async component with what it renders, at any depth", async () => {
		const tree = await resolveServerTree(
			<Wrapper>
				<div>
					<Greeting name="ada" />
				</div>
			</Wrapper>,
		);

		const text = JSON.stringify(tree);
		expect(text).toContain("hello ada");
		expect(text).not.toContain("Greeting");
	});

	it("keeps strings, arrays and elements without children as they are", async () => {
		expect(await resolveServerTree("text")).toBe("text");
		expect(await resolveServerTree([<hr key="a" />, "x"])).toHaveLength(2);
	});
});

let slowRuns = 0;
async function Slow() {
	slowRuns++;
	return <p>late</p>;
}

describe("firstPaint", () => {
	it("replaces each Suspense boundary with its fallback and runs nothing inside", () => {
		slowRuns = 0;
		const tree = firstPaint(
			<Wrapper>
				<h1>title</h1>
				<Suspense fallback={<p>waiting</p>}>
					<Slow />
				</Suspense>
			</Wrapper>,
		);

		const text = JSON.stringify(tree);
		expect(text).toContain("title");
		expect(text).toContain("waiting");
		expect(text).not.toContain("Slow");
		expect(slowRuns).toBe(0);
	});

	it("keeps a tree without a boundary as it is", () => {
		expect(JSON.stringify(firstPaint(<Wrapper>plain</Wrapper>))).toContain(
			"plain",
		);
		expect(firstPaint("text")).toBe("text");
	});
});

async function Frame() {
	return (
		<Wrapper>
			<Greeting name="ada" />
			<Suspense fallback={<Greeting name="waiting" />}>
				<Slow />
			</Suspense>
		</Wrapper>
	);
}

describe("resolveFirstPaint", () => {
	it("runs the server components outside a boundary and stops at each boundary, whose fallback it resolves too", async () => {
		slowRuns = 0;

		const text = JSON.stringify(await resolveFirstPaint(<Frame />));

		expect(text).toContain("hello ada");
		expect(text).toContain("hello waiting");
		expect(text).not.toContain("late");
		expect(slowRuns).toBe(0);
	});

	it("keeps strings and arrays, and a boundary without a fallback is nothing", async () => {
		expect(await resolveFirstPaint("text")).toBe("text");
		expect(await resolveFirstPaint([<hr key="a" />, "x"])).toHaveLength(2);
		expect(
			await resolveFirstPaint(
				<Suspense>
					<Slow />
				</Suspense>,
			),
		).toBeNull();
	});
});

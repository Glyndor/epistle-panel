import { describe, expect, it } from "bun:test";

import { Suspense } from "react";

import { firstPaint, resolveServerTree } from ".";

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

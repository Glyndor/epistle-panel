import { describe, expect, it } from "bun:test";

import { resolveServerTree } from ".";

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

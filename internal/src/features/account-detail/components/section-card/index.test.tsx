import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SectionCard } from ".";

afterEach(cleanup);

describe("SectionCard", () => {
	it("is a region named by its heading, with the help and the content", () => {
		render(
			<SectionCard id="demo" title="Demo" description="Some help">
				<p>content</p>
			</SectionCard>,
		);

		const region = screen.getByRole("region", { name: "Demo" });
		expect(region).toContainElement(screen.getByText("content"));
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
			"Demo",
		);
		expect(screen.getByText("Some help")).toBeInTheDocument();
	});

	it("leaves out the help line when there is none", () => {
		render(
			<SectionCard id="demo" title="Demo">
				<p>content</p>
			</SectionCard>,
		);

		expect(document.querySelector("p.text-muted-foreground")).toBeNull();
	});
});

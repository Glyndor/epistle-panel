import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

const { default: NotFound } = await import("./not-found");

afterEach(cleanup);

describe("NotFound", () => {
	it("explains the missing page and links back to the status page", async () => {
		render(await NotFound());

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "home" })).toHaveAttribute(
			"href",
			"/app",
		);
	});

	it("uses no inline style, which the style-src policy blocks", async () => {
		const { container } = render(await NotFound());

		expect(container.querySelector("style, [style]")).toBeNull();
	});
});

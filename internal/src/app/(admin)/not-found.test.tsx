import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

const { default: AdminNotFound } = await import("./not-found");

afterEach(cleanup);

describe("AdminNotFound", () => {
	it("explains the missing page and links back to the status page", async () => {
		render(await AdminNotFound());

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "home" })).toHaveAttribute(
			"href",
			"/app",
		);
	});

	it("opens no landmark of its own, since the shell already has the main one", async () => {
		const { container } = render(await AdminNotFound());

		expect(container.querySelector("main, [role='main']")).toBeNull();
	});

	it("uses no inline style, which the style-src policy blocks", async () => {
		const { container } = render(await AdminNotFound());

		expect(container.querySelector("style, [style]")).toBeNull();
	});
});

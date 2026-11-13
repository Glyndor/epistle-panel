import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";

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
			`/app/${TEST_ADMIN_ID}`,
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

	it("links back to the root, with no id, when the installation has no admin id", async () => {
		const saved = process.env["EPISTLE_PANEL_ADMIN_ID"];
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];
		try {
			render(await AdminNotFound());

			expect(screen.getByRole("link", { name: "home" })).toHaveAttribute(
				"href",
				"/",
			);
		} finally {
			process.env["EPISTLE_PANEL_ADMIN_ID"] = saved;
		}
	});
});

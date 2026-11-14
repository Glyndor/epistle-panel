import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

import { CardLink } from ".";

afterEach(cleanup);

describe("CardLink", () => {
	it("is a link to the page of the data, with its words", () => {
		render(
			<CardLink href={adminRoutes(TEST_ADMIN_ID).queue} label="Queue" />,
		);

		expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}/queue`,
		);
	});

	it("shows keyboard focus, is big enough for a finger and draws no icon", () => {
		const { container } = render(
			<CardLink href={adminRoutes(TEST_ADMIN_ID).queue} label="Queue" />,
		);
		const link = screen.getByRole("link");

		expect(link).toHaveClass(
			"focus-visible:outline-2",
			"pointer-coarse:min-h-11",
		);
		expect(container.querySelector("svg")).toBeNull();
	});
});

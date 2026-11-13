import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	OTHER_ADMIN_ID,
	TEST_ADMIN_ID,
} from "@/lib/config/test-support/admin-id";

import { AdminRoutesProvider, useAdminRoutes } from ".";

afterEach(cleanup);

function Probe() {
	return <p>{String(useAdminRoutes().queue)}</p>;
}

describe("AdminRoutesProvider", () => {
	it("hands the client components the admin paths built from its id", () => {
		render(
			<AdminRoutesProvider adminId={TEST_ADMIN_ID}>
				<Probe />
			</AdminRoutesProvider>,
		);

		expect(
			screen.getByText(`/app/${TEST_ADMIN_ID}/queue`),
		).toBeInTheDocument();
	});

	it("follows a change of id", () => {
		const { rerender } = render(
			<AdminRoutesProvider adminId={TEST_ADMIN_ID}>
				<Probe />
			</AdminRoutesProvider>,
		);
		rerender(
			<AdminRoutesProvider adminId={OTHER_ADMIN_ID}>
				<Probe />
			</AdminRoutesProvider>,
		);

		expect(
			screen.getByText(`/app/${OTHER_ADMIN_ID}/queue`),
		).toBeInTheDocument();
	});

	it("refuses an id that is not a UUID v4 instead of building paths from it", () => {
		const error = spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(() =>
				render(
					<AdminRoutesProvider adminId="../x">
						<Probe />
					</AdminRoutesProvider>,
				),
			).toThrow();
		} finally {
			error.mockRestore();
		}
	});

	it("throws outside the provider, which is a bug and not a state", () => {
		const error = spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(() => render(<Probe />)).toThrow("AdminRoutesProvider");
		} finally {
			error.mockRestore();
		}
	});
});

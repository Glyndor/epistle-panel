import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";

const cookies = mockRequestCookies();
const { default: MailPage } = await import("./page");
const { default: MailLayout } = await import("./layout");

beforeEach(() => cookies.reset());
afterEach(cleanup);

describe("MailPage", () => {
	it("says the mail client is not available yet and offers to sign out, for a user", async () => {
		await cookies.signIn("ana", "user");

		render(await MailPage());

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByText("body")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "logout" }),
		).toBeInTheDocument();
	});

	it("never gives a user the way into the admin area, nor the id", async () => {
		await cookies.signIn("ana", "user");

		const { container } = render(await MailPage());

		expect(screen.queryByRole("link", { name: "admin" })).toBeNull();
		expect(container.innerHTML).not.toContain(TEST_ADMIN_ID);
	});

	it("gives an admin the link to the admin panel, built on the server with the id", async () => {
		await cookies.signIn("ops", "admin");

		render(await MailPage());

		expect(screen.getByRole("link", { name: "admin" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}`,
		);
	});

	it("gives an admin no link when the installation has no admin id", async () => {
		await cookies.signIn("ops", "admin");
		const saved = process.env["EPISTLE_PANEL_ADMIN_ID"];
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];
		try {
			render(await MailPage());

			expect(screen.queryByRole("link", { name: "admin" })).toBeNull();
		} finally {
			process.env["EPISTLE_PANEL_ADMIN_ID"] = saved;
		}
	});

	it("redirects to the sign-in page without a session, in the page and in the layout", async () => {
		for (const render of [
			() => MailPage(),
			() => MailLayout({ children: <p>x</p> }),
		]) {
			const outcome = await render().catch((e) => e);

			expect(outcome).toBeInstanceOf(RedirectSignal);
			expect(outcome.target).toBe("/");
		}
	});

	it("frames the page for a session of any role, with the one main landmark", async () => {
		for (const role of ["admin", "user"] as const) {
			await cookies.signIn("someone", role);

			render(await MailLayout({ children: <p>inside</p> }));

			expect(screen.getAllByRole("main")).toHaveLength(1);
			expect(screen.getByRole("main")).toContainElement(
				screen.getByText("inside"),
			);
			cleanup();
		}
	});
});

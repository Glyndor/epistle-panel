import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withQuery } from "@/test/query-wrapper";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();
const { default: MailLayout } = await import("./layout");

beforeEach(() => cookies.reset());
afterEach(cleanup);

describe("MailLayout", () => {
	it("redirects to sign-in without a session, before rendering anything", async () => {
		const outcome = await MailLayout({ children: <p>page</p> }).catch(
			(e) => e,
		);
		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/");
	});

	it("draws the skip link first, one main landmark and the page, with no sidebar", async () => {
		await cookies.signIn("ana", "user");
		render(
			withQuery(
				await resolveServerTree(
					await MailLayout({ children: <p>page</p> }),
				),
			),
		);
		expect(screen.getAllByRole("main")).toHaveLength(1);
		expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
		expect(screen.getByRole("main")).toContainElement(
			screen.getByText("page"),
		);
		const first = document.querySelector("a, button, select");
		expect(first).toHaveAttribute("href", "#main-content");
		expect(screen.queryByRole("complementary")).toBeNull();
		expect(screen.queryByRole("link", { name: "admin" })).toBeNull();
	});

	it("offers an admin session the way into the administration, built on the server", async () => {
		await cookies.signIn("ops", "admin");
		render(
			withQuery(
				await resolveServerTree(
					await MailLayout({ children: <p>page</p> }),
				),
			),
		);
		expect(screen.getByRole("link", { name: "admin" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}`,
		);
	});
});

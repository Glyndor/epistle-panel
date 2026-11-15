import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { intl, resetIntl } from "@/test/next-intl";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();
const { default: MePage } = await import("./page");

beforeEach(() => {
	cookies.reset();
	resetIntl();
});
afterEach(cleanup);

async function renderPage() {
	render(await resolveServerTree(await MePage()));
}
const select = (label: string) =>
	screen.getByLabelText(label) as HTMLSelectElement;

describe("MePage", () => {
	it("redirects to sign-in without a session, before it reads anything", async () => {
		const outcome = await MePage().catch((e) => e);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/");
	});

	it("has one heading, says where the choices are kept, and draws the form, for either role", async () => {
		for (const role of ["admin", "user"] as const) {
			cookies.reset();
			await cookies.signIn("ana", role);
			await renderPage();

			expect(screen.getAllByRole("heading")).toHaveLength(1);
			expect(
				screen.getByRole("heading", { level: 1, name: "heading" }),
			).toBeInTheDocument();
			expect(screen.getByText("intro")).toBeInTheDocument();
			expect(
				screen.getByRole("form", { name: "formLabel" }),
			).toBeInTheDocument();
			cleanup();
		}
	});

	it("shows the choices in force at first paint: the language of the request and the checked cookies", async () => {
		await cookies.signIn();
		intl.locale = "fr";
		cookies.jar.set("theme", "dark");
		cookies.jar.set("list-density", "compact");

		await renderPage();

		expect(select("language").value).toBe("fr");
		expect(select("theme").value).toBe("dark");
		expect(select("density").value).toBe("compact");
	});

	it("shows the defaults for cookies that are none of the choices, and none of their text", async () => {
		await cookies.signIn();
		cookies.jar.set("theme", '"><script>alert(1)</script>');
		cookies.jar.set("list-density", "huge");

		await renderPage();

		expect(select("theme").value).toBe("system");
		expect(select("density").value).toBe("comfortable");
		expect(document.body.innerHTML).not.toContain("<script>alert(1)");
		expect(document.body.innerHTML).not.toContain("huge");
	});
});

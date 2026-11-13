import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { LanguageSelect } = await import(".");

beforeEach(() => {
	resetIntl();
	cookies.reset();
});
afterEach(cleanup);

describe("LanguageSelect", () => {
	it("offers every shipped language by its own name, the current one chosen", () => {
		render(<LanguageSelect />);
		const select = screen.getByRole("combobox");
		expect(select).toHaveValue("en");
		expect(
			Array.from(select.querySelectorAll("option")).map(
				(o) => o.textContent,
			),
		).toEqual(SUPPORTED_LOCALES.map((code) => LOCALE_NAMES[code]));
	});

	it("wears the shared field look, sized to its content", () => {
		render(<LanguageSelect />);
		const select = screen.getByRole("combobox");
		expect(select).toHaveClass("bg-field", "min-h-8", "w-auto");
		expect(select).not.toHaveClass("w-full");
		expect(select.className).not.toMatch(/(^|\s)border/);
	});

	it("stores the chosen language through the action", async () => {
		await cookies.signIn("admin");
		render(<LanguageSelect />);
		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "es" },
		});
		await waitFor(() =>
			expect(
				cookies.writes.some(
					(w) => w.name === "locale" && w.value === "es",
				),
			).toBe(true),
		);
	});

	it("does nothing for the current language or a value that is not one", async () => {
		await cookies.signIn("admin");
		render(<LanguageSelect />);
		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: "en" } });
		await new Promise((r) => setTimeout(r, 20));
		expect(cookies.writes).toHaveLength(0);
	});
});

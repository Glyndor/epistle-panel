import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import en from "@/i18n/messages/en/error.json";

import GlobalError from "./global-error";

afterEach(() => {
	cleanup();
	// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
	document.cookie = "locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("global error page", () => {
	it("starts in English and retries through Next's reset", () => {
		const reset = mock(() => {});
		render(
			<GlobalError error={new Error("secret detail")} reset={reset} />,
		);

		expect(
			screen.getByRole("heading", { level: 1, name: en.heading }),
		).toBeInTheDocument();
		screen.getByRole("button", { name: en.retry }).click();
		expect(reset).toHaveBeenCalledTimes(1);
	});

	for (const locale of SUPPORTED_LOCALES.filter((code) => code !== "en")) {
		it(`switches to ${locale} when the locale cookie says so`, async () => {
			const catalog = (
				await import(`@/i18n/messages/${locale}/error.json`)
			).default as typeof en;
			// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
			document.cookie = `locale=${locale}`;

			render(<GlobalError error={new Error("x")} reset={() => {}} />);

			await waitFor(() =>
				expect(
					screen.getByRole("heading", {
						level: 1,
						name: catalog.heading,
					}),
				).toBeInTheDocument(),
			);
		});
	}

	it("falls back to English for an unknown locale", () => {
		// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
		document.cookie = "locale=xx";

		render(<GlobalError error={new Error("x")} reset={() => {}} />);

		expect(
			screen.getByRole("heading", { name: en.heading }),
		).toBeInTheDocument();
	});

	it("does not show the error message and uses no inline style", () => {
		const { container } = render(
			<GlobalError error={new Error("secret detail")} reset={() => {}} />,
		);

		expect(container).not.toHaveTextContent("secret detail");
		expect(container.querySelector("style, [style]")).toBeNull();
	});
});

import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Window } from "happy-dom";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import en from "@/i18n/messages/en/error.json";

import GlobalError from "./global-error";

/**
 * `GlobalError` renders `<html>` and `<body>`, and React claims those two from
 * the document of the container it renders into. In the shared test document
 * that would leave `document.body` owned by this tree, and the next test that
 * portals into the body (a modal dialog does) then hangs inside React's event
 * dispatch. A document of its own keeps the claim contained.
 */
function renderGlobalError(reset: () => void = () => {}) {
	const win = new Window();
	const body = win.document.body as unknown as HTMLElement;
	const container = body.appendChild(
		win.document.createElement("div") as unknown as HTMLElement,
	);
	return render(
		<GlobalError error={new Error("secret detail")} reset={reset} />,
		{ container, baseElement: body },
	);
}

afterEach(() => {
	cleanup();
	// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
	document.cookie = "locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
	// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
	document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("global error page", () => {
	it("starts in English and retries through Next's reset", () => {
		const reset = mock(() => {});
		const view = renderGlobalError(reset);

		expect(
			view.getByRole("heading", { level: 1, name: en.heading }),
		).toBeInTheDocument();
		view.getByRole("button", { name: en.retry }).click();
		expect(reset).toHaveBeenCalledTimes(1);
	});

	for (const locale of SUPPORTED_LOCALES.filter((code) => code !== "en")) {
		it(`switches to ${locale} when the locale cookie says so`, async () => {
			const catalog = (
				await import(`@/i18n/messages/${locale}/error.json`)
			).default as typeof en;
			// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
			document.cookie = `locale=${locale}`;

			const view = renderGlobalError();

			await waitFor(() =>
				expect(
					view.getByRole("heading", {
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

		const view = renderGlobalError();

		expect(
			view.getByRole("heading", { name: en.heading }),
		).toBeInTheDocument();
	});

	for (const theme of ["light", "dark"]) {
		it(`shows the ${theme} theme when the theme cookie says so`, async () => {
			// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
			document.cookie = `theme=${theme}`;

			const view = renderGlobalError();
			const html = view.container.ownerDocument.documentElement;

			await waitFor(() =>
				expect(html.getAttribute("data-theme")).toBe(theme),
			);
		});
	}

	it("leaves the theme to the browser for no cookie, the system choice or a tampered value", async () => {
		const spanish = (await import("@/i18n/messages/es/error.json"))
			.default as typeof en;
		// The locale is read in the same effect as the theme: once the page
		// is in Spanish, the theme cookie has been read too.
		// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
		document.cookie = "locale=es";
		for (const value of [undefined, "system", "DARK", "dark%20", "x"]) {
			if (value !== undefined) {
				// biome-ignore lint/suspicious/noDocumentCookie: the page reads this cookie, so the test sets it
				document.cookie = `theme=${value}`;
			}

			const view = renderGlobalError();
			await waitFor(() =>
				expect(
					view.getByRole("heading", { name: spanish.heading }),
				).toBeInTheDocument(),
			);

			expect(
				view.container.ownerDocument.documentElement.hasAttribute(
					"data-theme",
				),
			).toBe(false);
			cleanup();
		}
	});

	it("does not show the error message and uses no inline style", () => {
		const { container } = renderGlobalError();

		expect(container).not.toHaveTextContent("secret detail");
		expect(container.querySelector("style, [style]")).toBeNull();
	});
});

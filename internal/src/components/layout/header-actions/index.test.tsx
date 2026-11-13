import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { HeaderActions } from ".";

afterEach(cleanup);

/** The part of the server markup a browser shows only without script. */
function withoutScript(html: string): string {
	return /<noscript>([\s\S]*)<\/noscript>/.exec(html)?.[1] ?? "";
}

describe("HeaderActions", () => {
	it("draws the theme button and the profile menu, in that order", () => {
		render(<HeaderActions name="ana" sessionRole="user" />);

		expect(
			screen
				.getAllByRole("button")
				.map((b) => b.querySelector(".sr-only")?.textContent),
		).toEqual(["themeCurrent", "account"]);
	});

	it("keeps sign out as a plain form in the markup, for a browser without script", () => {
		const fallback = withoutScript(
			renderToStaticMarkup(
				<HeaderActions name="ana" sessionRole="user" />,
			),
		);

		// A form with an action of its own, and a submit button inside it.
		expect(fallback).toMatch(
			/<form[^>]*action=[^>]*>.*<button[^>]*type="submit"[^>]*>.*logout.*<\/form>/s,
		);
		// A user session is given no way into the administration.
		expect(fallback).not.toContain("<a ");
		expect(fallback).not.toContain("administration");
	});

	it("keeps the way into the administration as a plain link there, when the server gave one", () => {
		const html = renderToStaticMarkup(
			<HeaderActions
				name="ops"
				sessionRole="admin"
				adminHref="/app/abc"
			/>,
		);

		expect(withoutScript(html)).toMatch(
			/<a[^>]*href="\/app\/abc"[^>]*>administration<\/a>/,
		);
		expect(withoutScript(html)).toContain("<form");
	});

	it("draws no link there for an admin session the server gave no address", () => {
		// The admin area is off: the role alone opens nothing.
		const fallback = withoutScript(
			renderToStaticMarkup(
				<HeaderActions name="ops" sessionRole="admin" />,
			),
		);

		expect(fallback).not.toContain("<a ");
		expect(fallback).not.toContain("administration");
		expect(fallback).toContain("<form");
	});

	it("uses no inline style", () => {
		expect(
			renderToStaticMarkup(
				<HeaderActions
					name="ops"
					sessionRole="admin"
					adminHref="/app/abc"
				/>,
			),
		).not.toMatch(/ style=|<style/);
	});
});

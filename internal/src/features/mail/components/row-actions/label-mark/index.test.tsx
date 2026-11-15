import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { stubJmap } from "../../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { LabelMark } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000d1";

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
	stubJmap({});
});
afterEach(async () => {
	await settled();
	cleanup();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

describe("LabelMark", () => {
	it("is a button named for what it opens, shown the way the other marks of a row are", () => {
		render(withQuery(<LabelMark id={ID} labels={[]} />));
		const mark = screen.getByRole("button", { name: "labelAs" });

		expect(mark).toHaveAttribute("data-mark", "label");
		expect(mark).toHaveClass(
			"size-6",
			"opacity-0",
			"focus-visible:opacity-100",
			"group-focus-within/row:opacity-100",
			"group-hover/row:opacity-100",
			"pointer-coarse:size-11",
			"pointer-coarse:opacity-100",
		);
		expect(mark.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});

	it("opens the labels of its message in a dialog", async () => {
		render(
			withQuery(
				<LabelMark
					id={ID}
					labels={[{ keyword: "Work", name: "Work", tone: 1 }]}
				/>,
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "labelAs" }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect(
			(screen.getByRole("checkbox", { name: "Work" }) as HTMLInputElement)
				.checked,
		).toBe(true);
	});
});

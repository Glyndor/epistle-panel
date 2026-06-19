import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { Status } from "@/lib/api/schemas";

// State the mocked client returns, flipped per test.
let status: Status;
let shouldThrow = false;

// Translations: echo the key so assertions stay locale-independent.
mock.module("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));
mock.module("@/lib/api/client", () => ({
	getStatus: async () => {
		if (shouldThrow) {
			throw new Error("unreachable");
		}
		return status;
	},
}));

const { default: HomePage } = await import("./page");

afterEach(cleanup);

describe("HomePage", () => {
	it("renders a card per counter when the API responds", async () => {
		shouldThrow = false;
		status = { version: "0.1.0", domains: 2, accounts: 5, queue_size: 3 };

		render(await HomePage());

		expect(screen.getByText("0.1.0")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("renders the unreachable notice when the API errors", async () => {
		shouldThrow = true;

		render(await HomePage());

		expect(screen.getByText("unreachable")).toBeInTheDocument();
	});
});

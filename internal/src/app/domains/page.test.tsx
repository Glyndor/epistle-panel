import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-fetch";

mock.module("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));

const { default: DomainsPage } = await import("./page");

afterEach(cleanup);

describe("DomainsPage", () => {
	it("lists each configured domain", async () => {
		stubFetchJson({ domains: ["example.org", "example.net"] });

		render(await DomainsPage());

		expect(screen.getByText("example.org")).toBeInTheDocument();
		expect(screen.getByText("example.net")).toBeInTheDocument();
	});

	it("shows the empty state when there are no domains", async () => {
		stubFetchJson({ domains: [] });

		render(await DomainsPage());

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(await DomainsPage());

		expect(screen.getByRole("alert")).toHaveTextContent("unreachable");
	});
});

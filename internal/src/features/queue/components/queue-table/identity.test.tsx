import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { queueKeys } from "@/features/queue/queries/queue-query";
import { withAdminRoutes } from "@/test/admin-routes";
import { resetIntl } from "@/test/next-intl";
import { withQuery } from "@/test/query-wrapper";

import { QueueTable } from ".";

afterEach(() => {
	cleanup();
	resetIntl();
});

it("keeps the queue identity's accessible text and link behavior with its send icon", () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
		},
	});
	client.setQueryData(queueKeys.page(undefined), {
		entries: [
			{
				id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
				from: "s@example.org",
				recipients: ["r@example.net"],
			},
		],
		nextCursor: null,
	});
	try {
		render(
			withAdminRoutes(
				withQuery(<QueueTable cursor={undefined} />, client),
			),
		);

		const cell = screen.getByRole("cell", { name: "s@example.org" });
		expect(cell.textContent).toBe("s@example.org");
		expect(cell.querySelector("a")).toBeNull();
		expect(cell.querySelector('[data-glyph="send"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	} finally {
		cleanup();
		client.clear();
	}
});

import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { DeliveryFilters } from "@/features/deliveries/schemas/deliveries-input";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

import { DeliveriesFilters } from ".";

const PATH = adminRoutes(TEST_ADMIN_ID).deliveries;

afterEach(cleanup);

const open = (filters: DeliveryFilters = {}) =>
	render(<DeliveriesFilters filters={filters} path={PATH} />);

describe("DeliveriesFilters", () => {
	it("is a GET form to the delivery log path with a labelled control per filter", () => {
		const { container } = open();

		const form = container.querySelector("form");
		expect(form?.getAttribute("method")).toBe("get");
		expect(form?.getAttribute("action")).toBe(
			`/app/${TEST_ADMIN_ID}/deliveries`,
		);
		expect(screen.getByLabelText("outcome")).toHaveAttribute(
			"name",
			"outcome",
		);
		expect(screen.getByLabelText("since")).toHaveAttribute("name", "since");
		expect(screen.getByLabelText("recipient")).toHaveAttribute(
			"name",
			"recipient",
		);
		expect(
			screen.getByRole("button", { name: "apply" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "clear" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}/deliveries`,
		);
	});

	it("offers every outcome and window, and starts on the current filters", () => {
		open({ outcome: "failed", since: "7d", recipient: "a@b.org" });

		const outcome = screen.getByLabelText("outcome") as HTMLSelectElement;
		expect([...outcome.options].map((o) => o.value)).toEqual([
			"",
			"delivered",
			"deferred",
			"failed",
			"suppressed",
			"canceled",
		]);
		expect(outcome.value).toBe("failed");
		const since = screen.getByLabelText("since") as HTMLSelectElement;
		expect([...since.options].map((o) => o.value)).toEqual([
			"",
			"15m",
			"1h",
			"24h",
			"7d",
			"30d",
		]);
		expect(since.value).toBe("7d");
		expect(screen.getByLabelText("recipient")).toHaveValue("a@b.org");
	});

	it("caps the recipient field at the address length the actions accept", () => {
		open();

		expect(screen.getByLabelText("recipient")).toHaveAttribute(
			"maxlength",
			"254",
		);
	});
});

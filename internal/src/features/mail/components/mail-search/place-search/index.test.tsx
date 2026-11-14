import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactElement } from "react";

import type { ListConditions } from "@/features/mail/schemas/list-conditions-model";
import { resetIntl, saidWith } from "@/test/next-intl";

import { PlaceSearch } from ".";

/** What the search of a place is made of: the field of the search and the notice under it. */
type Child = ReactElement<{
	conditions?: ListConditions;
	role?: string;
}>;

beforeEach(() => {
	resetIntl();
});
afterEach(cleanup);

/**
 * The search of a place, with what the address holds.
 *
 * The place's search is a server component: it is read here, not drawn, so
 * what it says and what it hands to the field can be looked at.
 */
async function place(
	searchParams: Record<string, string | string[] | undefined>,
) {
	const element = (await PlaceSearch({
		place: { box: "INBOX", role: "inbox" },
		searchParams: Promise.resolve(searchParams),
	})) as ReactElement<{ children: ReactElement[] }>;
	const children = Children.toArray(element.props.children) as Child[];
	const search = children.find(
		(child) =>
			isValidElement(child) && child.props.conditions !== undefined,
	);
	const alert = children.find(
		(child) => isValidElement(child) && child.props.role === "alert",
	);
	return {
		conditions: search?.props.conditions,
		alert: alert ?? null,
	};
}

describe("the search of a place", () => {
	it("says nothing when the address holds nothing to refuse", async () => {
		const { alert } = await place({ q: "invoice", unread: "1" });

		expect(alert).toBeNull();
	});

	it("names the condition the server did not apply", async () => {
		const { alert } = await place({ q: "a".repeat(201) });

		render(alert as ReactElement);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"conditionRejected",
		);
		// The name of the condition is said, so the person knows which one
		// was dropped.
		expect(saidWith("conditionRejected")).toEqual([
			{ name: "searchWords" },
		]);
	});

	it("names every condition it did not apply", async () => {
		await place({
			q: "a".repeat(201),
			after: "2026-02-30",
			label: "$seen",
		});

		expect(saidWith("conditionRejected")).toEqual([
			{ name: "searchWords, conditionAfter, conditionLabel" },
		]);
	});

	it("keeps the conditions it did apply, and drops only the others", async () => {
		const { conditions } = await place({ q: "a".repeat(201), from: "ana" });

		// The words were refused, the sender was kept: the field of the
		// search holds the sender and not the words.
		expect(conditions?.from).toBe("ana");
		expect(conditions?.q).toBe("");
	});

	it("does not say a condition it applied", async () => {
		const { alert } = await place({ from: "ana", order: "oldest" });

		expect(alert).toBeNull();
	});

	it("folds the filter of the address from before into the quick filters", async () => {
		const { conditions } = await place({ filter: "flagged" });

		expect(conditions?.starred).toBe(true);
	});
});

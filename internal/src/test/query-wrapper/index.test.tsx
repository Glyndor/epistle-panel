import { afterEach, describe, expect, it } from "bun:test";
import { useQuery } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { betweenCases, inFlight, settled, testQueryClient, withQuery } from ".";

afterEach(cleanup);

function Failing() {
	const { isError } = useQuery({
		queryKey: ["x"],
		queryFn: async () => {
			throw new Error("no");
		},
	});
	return <p>{isError ? "failed" : "pending"}</p>;
}

describe("withQuery", () => {
	it("settles a failing query without retrying", async () => {
		render(withQuery(<Failing />));

		expect(await screen.findByText("failed")).toBeInTheDocument();
	});

	it("creates a new client each time", () => {
		expect(testQueryClient()).not.toBe(testQueryClient());
	});
});

/** A request the case answers when it chooses. */
function held<T>() {
	let answer: (value: T) => void = () => {};
	const promise = new Promise<T>((resolve) => {
		answer = resolve;
	});
	return { promise, answer };
}

describe("the requests of a case", () => {
	it("names a query being fetched and a mutation not yet settled, and nothing once they are", async () => {
		const client = testQueryClient();
		const query = held<string>();
		const mutation = held<string>();

		const fetched = client.fetchQuery({
			queryKey: ["accounts", "alice"],
			queryFn: () => query.promise,
		});
		const mutated = client
			.getMutationCache()
			.build(client, { mutationFn: () => mutation.promise })
			.execute(undefined);
		await Promise.resolve();

		expect(inFlight().sort()).toEqual(['["accounts","alice"]', "mutation"]);
		query.answer("a");
		mutation.answer("b");
		await Promise.all([fetched, mutated]);
		expect(inFlight()).toEqual([]);
	});

	it("waits for a request that answers, and says what is left of one that does not", async () => {
		const client = testQueryClient();
		const query = held<string>();
		const fetched = client.fetchQuery({
			queryKey: ["slow"],
			queryFn: () => query.promise,
		});

		await expect(settled(20)).rejects.toThrow(
			'still on its way after 20 ms: ["slow"]',
		);
		setTimeout(() => query.answer("late"), 5);
		await settled();
		expect(await fetched).toBe("late");
		expect(inFlight()).toEqual([]);
	});

	it("between two cases lets a request finish, then forgets the clients of the case before", async () => {
		const client = testQueryClient();
		const query = held<string>();
		const fetched = client.fetchQuery({
			queryKey: ["left", "behind"],
			queryFn: () => query.promise,
		});
		setTimeout(() => query.answer("late"), 5);

		expect(await betweenCases()).toEqual([]);
		expect(await fetched).toBe("late");
		// Forgotten: a later request of that client is no longer this case's.
		const again = held<string>();
		const second = client.fetchQuery({
			queryKey: ["after"],
			queryFn: () => again.promise,
		});
		expect(inFlight()).toEqual([]);
		again.answer("done");
		await second;
	});

	it("between two cases gives up on a request that never answers, says which, and does not fail", async () => {
		const client = testQueryClient();
		const never = held<string>();
		const fetched = client.fetchQuery({
			queryKey: ["hung"],
			queryFn: () => never.promise,
		});

		const started = Date.now();
		expect(await betweenCases(20)).toEqual(['["hung"]']);
		expect(Date.now() - started).toBeLessThan(200);
		expect(inFlight()).toEqual([]);
		never.answer("closed");
		await fetched;
	});
});

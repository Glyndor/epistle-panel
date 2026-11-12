import { afterEach, describe, expect, it } from "bun:test";
import { useQuery } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { testQueryClient, withQuery } from ".";

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

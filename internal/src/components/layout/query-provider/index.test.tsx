import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { ActionError } from "@/lib/query/action-result";

import { QueryProvider } from ".";

afterEach(cleanup);

const seen: unknown[] = [];

function Collect() {
	seen.push(useQueryClient());
	return null;
}

function Data() {
	const { data } = useQuery({
		queryKey: ["k"],
		queryFn: async () => "loaded",
	});
	return <p>{data ?? "loading"}</p>;
}

function Ended() {
	useQuery({
		queryKey: ["ended"],
		queryFn: async () => {
			throw new ActionError("unauthenticated");
		},
	});
	return null;
}

function Probe() {
	const client = useQueryClient();
	return <p>{String(client.getDefaultOptions().queries?.staleTime)}</p>;
}

describe("QueryProvider", () => {
	it("gives its children a query client with the panel's defaults", () => {
		render(
			<QueryProvider>
				<Probe />
			</QueryProvider>,
		);

		expect(screen.getByText("30000")).toBeInTheDocument();
	});

	it("keeps one client across re-renders", () => {
		seen.length = 0;
		const { rerender } = render(
			<QueryProvider>
				<Collect />
			</QueryProvider>,
		);
		rerender(
			<QueryProvider>
				<Collect />
			</QueryProvider>,
		);

		expect(seen[0]).toBe(seen.at(-1));
	});

	it("runs a query for a child", async () => {
		render(
			<QueryProvider>
				<Data />
			</QueryProvider>,
		);

		expect(await screen.findByText("loaded")).toBeInTheDocument();
	});

	it("sends the browser to the login page when a query finds the session ended", async () => {
		const assign = spyOn(window.location, "assign").mockImplementation(
			() => {},
		);
		render(
			<QueryProvider>
				<Ended />
			</QueryProvider>,
		);

		await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
		assign.mockRestore();
	});
});

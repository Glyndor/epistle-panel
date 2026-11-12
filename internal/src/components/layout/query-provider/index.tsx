"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { makeQueryClient } from "@/lib/query/query-client";

/** Where the browser goes when a query finds the session ended. */
function goToLogin(): void {
	window.location.assign("/login");
}

/**
 * Query for the signed-in pages. The client is created once per browser tab, in
 * state, so it survives re-renders and is never shared between visitors. A
 * query that finds the session ended sends the person to sign in again.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(() => makeQueryClient(goToLogin));

	return (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}

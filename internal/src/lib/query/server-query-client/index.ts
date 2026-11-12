import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The query client of the current server request. `cache` gives one per render
 * pass and never shares one between requests, so a visitor's data cannot reach
 * another visitor's page. Pages prefetch into it and hand `dehydrate(client)` to
 * a `HydrationBoundary`.
 */
export const getServerQueryClient: () => QueryClient = cache(() =>
	makeQueryClient(),
);

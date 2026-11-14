import "server-only";

import { cache } from "react";

import { loadStatus } from "@/features/status/queries/load-status";
import type { StatusView } from "@/features/status/schemas/status-view";

/**
 * The status of the request: the counters prefetch it and the notice of the
 * overview asks whether it came, and the API is asked once.
 */
export const requestStatus: () => Promise<StatusView> = cache(loadStatus);

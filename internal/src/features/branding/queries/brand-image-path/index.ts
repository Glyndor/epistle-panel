import "server-only";

import { BRAND_ORIGIN_VARIABLE } from "@/lib/config/brand-origin";
import { parseHttpsOrigin } from "@/lib/config/https-origin";

import type { BrandImageKind } from "../brand-image";

/**
 * Where the browser asks for the logo or the favicon: the panel's own
 * `/brand/<kind>` when the operator set no brand origin, and the same path on
 * that origin when they did (their content delivery network is expected to
 * serve the same bytes there). A value that is not an origin is ignored here;
 * the start check already stopped the server for it.
 */
export function brandImagePath(kind: BrandImageKind): string {
	const origin = parseHttpsOrigin(process.env[BRAND_ORIGIN_VARIABLE] ?? "");
	return `${origin ?? ""}/brand/${kind}`;
}

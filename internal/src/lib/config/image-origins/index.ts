import { BRAND_ORIGIN_VARIABLE } from "../brand-origin";
import { parseHttpsOrigin } from "../https-origin";
import { builtStaticOrigin } from "../static-origin";

/**
 * The origins the panel's own images may come from besides itself: the static
 * origin the build was made for (the icons its stylesheet draws are files
 * under `/_next/static`) and the brand origin, each only when set, once each.
 * It is what `img-src` is widened with and nothing else is. A brand value that
 * is not an origin is left out here; the start check already stopped the server
 * for it.
 */
export function imageOrigins(): readonly string[] {
	const origins = new Set<string>();
	const built = builtStaticOrigin();
	if (built !== null) {
		origins.add(built);
	}
	const brand = parseHttpsOrigin(process.env[BRAND_ORIGIN_VARIABLE] ?? "");
	if (brand !== undefined) {
		origins.add(brand);
	}
	return [...origins];
}

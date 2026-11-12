import "server-only";

import {
	brandNameSchema,
	DEFAULT_BRAND_NAME,
} from "@/features/branding/schemas/brand-name";
import { isOperatorFileConfigured } from "@/lib/config/operator-file";

/** Environment variables of the branding. */
export const BRAND_NAME_VARIABLE = "EPISTLE_PANEL_BRAND_NAME";
export const BRAND_LOGO_VARIABLE = "EPISTLE_PANEL_BRAND_LOGO_FILE";
export const BRAND_FAVICON_VARIABLE = "EPISTLE_PANEL_BRAND_FAVICON_FILE";

/** What the interface needs to know about the operator's branding. */
export interface Brand {
	name: string;
	hasLogo: boolean;
	hasFavicon: boolean;
}

/**
 * The branding in force. A name that fails validation falls back to the
 * default rather than breaking every page; the images are read by their own
 * routes, so only whether they are configured is decided here.
 */
export function getBrand(): Brand {
	const name = brandNameSchema.safeParse(process.env[BRAND_NAME_VARIABLE]);
	return {
		name: name.success ? name.data : DEFAULT_BRAND_NAME,
		hasLogo: isOperatorFileConfigured(BRAND_LOGO_VARIABLE),
		hasFavicon: isOperatorFileConfigured(BRAND_FAVICON_VARIABLE),
	};
}

import "server-only";

import {
	BRAND_FAVICON_VARIABLE,
	BRAND_LOGO_VARIABLE,
} from "@/features/branding/queries/brand";
import {
	type ImageType,
	sniffImage,
} from "@/features/branding/queries/sniff-image";
import { ConfigError } from "@/lib/config/config-error";
import { readOperatorFile } from "@/lib/config/operator-file";

/** Largest brand image accepted, in bytes. */
export const MAX_BRAND_IMAGE_BYTES = 256 * 1024;

export type BrandImageKind = "logo" | "favicon";

const VARIABLES: Record<BrandImageKind, string> = {
	logo: BRAND_LOGO_VARIABLE,
	favicon: BRAND_FAVICON_VARIABLE,
};

/** A brand image ready to serve. */
export interface BrandImage {
	bytes: Buffer;
	type: ImageType;
}

/**
 * The operator's logo or favicon, or `undefined` when none is configured.
 * Throws `ConfigError` when the file is unusable or is not an image the panel
 * serves (see `sniffImage`).
 */
export async function readBrandImage(
	kind: BrandImageKind,
): Promise<BrandImage | undefined> {
	const variable = VARIABLES[kind];
	const bytes = await readOperatorFile(variable, MAX_BRAND_IMAGE_BYTES);
	if (bytes === undefined) {
		return undefined;
	}
	const type = sniffImage(bytes);
	if (type === undefined) {
		throw new ConfigError(
			`${variable} is set but the file is not a supported image`,
		);
	}
	return { bytes, type };
}

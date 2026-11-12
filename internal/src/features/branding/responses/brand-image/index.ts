import "server-only";

import {
	type BrandImageKind,
	readBrandImage,
} from "@/features/branding/queries/brand-image";
import { logApiFailure } from "@/lib/api/log-failure";

/**
 * Answer a request for the operator's logo or favicon. A 404 when none is
 * configured or the file is unusable (logged, not shown). The route is public,
 * so the response carries its own policy: no sniffing, and a CSP that sandboxes
 * the document, so an SVG opened directly runs nothing.
 */
export async function brandImageResponse(
	kind: BrandImageKind,
): Promise<Response> {
	let image: Awaited<ReturnType<typeof readBrandImage>>;
	try {
		image = await readBrandImage(kind);
	} catch (error) {
		logApiFailure(`brand ${kind}`, error);
	}
	if (image === undefined) {
		return new Response(null, { status: 404 });
	}
	return new Response(new Uint8Array(image.bytes), {
		headers: {
			"Content-Type": image.type,
			"Cache-Control": "public, max-age=300",
			"Content-Security-Policy": "default-src 'none'; sandbox",
		},
	});
}

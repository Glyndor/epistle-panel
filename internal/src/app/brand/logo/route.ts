import { brandImageResponse } from "@/features/branding/responses/brand-image";

/** The operator's logo; see `features/branding`. Read on every request. */
export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
	return brandImageResponse("logo");
}

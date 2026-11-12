import { themeCssResponse } from "@/features/theme/responses/theme-css";

/** The operator's override stylesheet; see `features/theme`. Read on every request. */
export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
	return themeCssResponse();
}

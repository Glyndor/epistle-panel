import { composeResponse } from "@/features/mail/responses/compose-response";

/** Save a draft or send a message from the composer. See `composeResponse`. */
export function POST(request: Request) {
	return composeResponse(request);
}

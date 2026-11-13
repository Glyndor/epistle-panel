import { uploadResponse } from "@/features/mail/responses/upload-response";

/** Store one attachment for the composer. See `uploadResponse`. */
export function POST(request: Request) {
	return uploadResponse(request);
}

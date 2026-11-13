import { attachmentResponse } from "@/features/mail/responses/attachment-response";

/** One attachment of a message, always downloaded and never shown in the page. */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string; part: string }> },
) {
	const { id, part } = await params;
	return attachmentResponse(id, part);
}

import { bodyResponse } from "@/features/mail/responses/body-response";

/** The framed, sanitised HTML body of one message. `?images=1` loads its remote images. */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const images = new URL(request.url).searchParams.get("images") === "1";
	return bodyResponse(id, images);
}

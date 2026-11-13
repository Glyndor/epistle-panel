import { bodyResponse } from "@/features/mail/responses/body-response";

/**
 * The framed, sanitised HTML body of one message. `?images=1` loads its remote
 * images; `?theme=light` or `?theme=dark` is the theme pinned on the page that
 * frames it, and any other value is no theme.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const query = new URL(request.url).searchParams;
	const images = query.get("images") === "1";
	return bodyResponse(id, images, query.get("theme"));
}

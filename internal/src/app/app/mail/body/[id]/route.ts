import { allowsRemoteImages } from "@/features/mail/config/remote-images";
import { readEffectiveRemoteImagesMode } from "@/features/mail/queries/remote-images";
import { bodyResponse } from "@/features/mail/responses/body-response";

/**
 * The framed, sanitised HTML body of one message. `?images=1` asks for remote
 * images in the effective `ask` mode; `always` loads them and `never` refuses
 * them whatever the parameter says. `?theme=light` or `?theme=dark` is the
 * theme pinned on the page that frames it, and any other value is no theme.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const query = new URL(request.url).searchParams;
	const mode = await readEffectiveRemoteImagesMode();
	const images = allowsRemoteImages(mode, query.get("images") === "1");
	return bodyResponse(id, images, query.get("theme"));
}

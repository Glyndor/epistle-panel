import { useTranslations } from "next-intl";

import { bodyHref } from "@/features/mail/links/mail-href";

/**
 * The message's HTML body, shown in an iframe whose source is the panel's own
 * body route (sanitised there, under its own strict Content-Security-Policy).
 * The sandbox grants no scripts and no same-origin access: the frame cannot
 * read the panel's page, its cookies or its storage, and cannot run script. It
 * allows popups, and lets them leave the sandbox, only so that a link the
 * reader follows opens as an ordinary page in a new tab; the links carry
 * `noopener noreferrer`, so that page learns neither the panel's address nor
 * its window.
 */
export function BodyFrame({
	messageId,
	remoteImages,
}: {
	messageId: string;
	remoteImages: boolean;
}) {
	const t = useTranslations("mail");

	return (
		<iframe
			key={remoteImages ? "images" : "no-images"}
			title={t("bodyFrame")}
			src={bodyHref(messageId, remoteImages)}
			sandbox="allow-popups allow-popups-to-escape-sandbox"
			referrerPolicy="no-referrer"
			loading="eager"
			className="h-[70vh] min-h-96 w-full border-0 bg-background"
		/>
	);
}

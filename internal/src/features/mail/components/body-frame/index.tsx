import { useTranslations } from "next-intl";

import { bodyHref } from "@/features/mail/links/mail-href";
import { forcedTheme } from "@/features/theme/config/choices";
import { useDocumentTheme } from "@/features/theme/hooks/use-theme-choice";

/**
 * The message's HTML body, shown in an iframe whose source is the panel's own
 * body route (sanitised there, under its own strict Content-Security-Policy).
 * The sandbox grants no scripts and no same-origin access: the frame cannot
 * read the panel's page, its cookies or its storage, and cannot run script. It
 * allows popups, and lets them leave the sandbox, only so that a link the
 * reader follows opens as an ordinary page in a new tab; the links carry
 * `noopener noreferrer`, so that page learns neither the panel's address nor
 * its window. The frame is a document of its own, so the theme pinned on the
 * page travels in its address, and a change of theme loads it again in the new
 * one.
 */
export function BodyFrame({
	messageId,
	remoteImages,
}: {
	messageId: string;
	remoteImages: boolean;
}) {
	const t = useTranslations("mail");
	const theme = forcedTheme(useDocumentTheme());

	return (
		<iframe
			key={`${remoteImages ? "images" : "no-images"}-${theme ?? "system"}`}
			title={t("bodyFrame")}
			src={bodyHref(messageId, remoteImages, theme)}
			sandbox="allow-popups allow-popups-to-escape-sandbox"
			referrerPolicy="no-referrer"
			loading="eager"
			className="h-[70vh] min-h-96 w-full border-0 bg-background"
		/>
	);
}

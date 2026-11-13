"use client";

import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BodyFrame } from "@/features/mail/components/body-frame";
import { MailNotice } from "@/features/mail/components/mail-notice";
import type { MessageDetail } from "@/features/mail/schemas/mail-view";

/**
 * The body of the open message. An HTML body goes into the sandboxed frame
 * with its remote images held back: they are loaded only after the reader
 * presses the button, for this message and this visit, because a remote image
 * tells whoever hosts it that the message was opened and from where. A message
 * with both versions can be switched to its plain text. A text body is shown
 * as text, never as markup.
 */
export function BodyView({ message }: { message: MessageDetail }) {
	const t = useTranslations("mail");
	const [images, setImages] = useState(false);
	const [asText, setAsText] = useState(false);
	const { body } = message;

	if (body.kind === "none") {
		return <MailNotice tone="empty">{t("noBody")}</MailNotice>;
	}
	if (body.kind === "text") {
		return (
			<div className="p-4">
				{body.truncated ? (
					<p className="mb-2 text-muted-foreground text-sm">
						{t("truncated")}
					</p>
				) : null}
				<pre
					dir="auto"
					className="whitespace-pre-wrap break-words font-sans text-sm"
				>
					{body.text}
				</pre>
			</div>
		);
	}
	return (
		<div className="flex flex-col">
			<div className="flex flex-wrap items-center gap-2 p-2 text-sm">
				{body.blockedImages > 0 && !images && !asText ? (
					<>
						<p className="min-w-0 flex-1 text-muted-foreground">
							{t("imagesBlocked", { count: body.blockedImages })}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setImages(true)}
						>
							<ImageIcon aria-hidden="true" />
							{t("loadImages")}
						</Button>
					</>
				) : null}
				{body.truncated ? (
					<p className="text-muted-foreground">{t("truncated")}</p>
				) : null}
				{body.alternativeText !== null ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="ml-auto"
						onClick={() => setAsText((value) => !value)}
					>
						{asText ? t("showFormatted") : t("showText")}
					</Button>
				) : null}
			</div>
			{asText && body.alternativeText !== null ? (
				<pre
					dir="auto"
					className="whitespace-pre-wrap break-words p-4 font-sans text-sm"
				>
					{body.alternativeText}
				</pre>
			) : (
				<BodyFrame messageId={message.id} remoteImages={images} />
			)}
		</div>
	);
}

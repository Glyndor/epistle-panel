import { SendIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { mailHref } from "@/features/mail/links/mail-href";

/** The three ways out of the composer: send, save a draft, discard. */
export function ComposeActions({
	pending,
	onSaveDraft,
}: {
	/** What is on its way, if anything: it keeps both buttons from a second press. */
	pending: "draft" | "send" | null;
	onSaveDraft: () => void;
}) {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				type="submit"
				disabled={pending !== null}
				aria-busy={pending === "send"}
			>
				<SendIcon aria-hidden="true" />
				{t("send")}
			</Button>
			<Button
				type="button"
				variant="secondary"
				disabled={pending !== null}
				aria-busy={pending === "draft"}
				onClick={onSaveDraft}
			>
				{pending === "draft" ? t("savingDraft") : t("saveDraft")}
			</Button>
			<Button asChild variant="ghost">
				<Link href={mailHref({})}>{t("discard")}</Link>
			</Button>
		</div>
	);
}

"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useLabelChange } from "@/features/mail/components/label-menu/use-label-change";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import type { LabelView } from "@/features/mail/schemas/mail-view";

/**
 * The button inside a label's chip that takes the label off the message. It
 * removes by the label's keyword, which is what the message carries and what
 * identifies it, and never by writing the displayed name again: the name is
 * what the keyword is shown as, and two labels can show one name. Its name
 * says which label it is, since a message carries several and a reader of
 * the page by its buttons would otherwise hear "Remove" a few times.
 *
 * A removal shows at once and is put back, with a toast, when the server does
 * not make it. It shares its scope with the message's flags, so a removal and
 * a star on the same message wait for each other.
 */
export function LabelRemove({
	messageId,
	label,
}: {
	messageId: string;
	label: LabelView;
}) {
	const t = useTranslations("mail");
	const { apply } = useLabelChange(mailKeys.change(messageId).join(":"));
	const name = t("labelRemove", { name: label.name });

	return (
		<Tooltip label={name} side="bottom" align="end">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				data-slot="label-remove"
				data-keyword={label.keyword}
				className="size-6 shrink-0 rounded-full px-0 hover:bg-foreground/10 active:bg-foreground/15 pointer-coarse:size-11"
				onClick={() => apply([messageId], label, false)}
			>
				<XIcon aria-hidden="true" />
				<span className="sr-only">{name}</span>
			</Button>
		</Tooltip>
	);
}

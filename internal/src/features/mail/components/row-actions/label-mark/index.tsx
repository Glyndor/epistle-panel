"use client";

import { TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LabelMenu } from "@/features/mail/components/label-menu";
import { MARK_CLASS } from "@/features/mail/components/row-actions/mark";
import type { LabelView } from "@/features/mail/schemas/mail-view";

/**
 * The mark of a row that opens "Label as" for that message: a tag, shown with
 * the other marks (under the pointer, with the focus anywhere in the row, and
 * always on a coarse pointer). It is a button of the row's end, a sibling of
 * the row's link, and the dialog it opens takes the focus and gives it back
 * to it. It carries no state of its own: the labels are the chips, and the
 * dialog says which are on.
 */
export function LabelMark({
	id,
	labels,
}: {
	id: string;
	labels: readonly LabelView[];
}) {
	const t = useTranslations("mail");

	return (
		<LabelMenu targets={[{ id, labels }]}>
			<Tooltip label={t("labelAs")} side="bottom" align="end">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					data-mark="label"
					className={MARK_CLASS}
				>
					<TagIcon aria-hidden="true" />
					<span className="sr-only">{t("labelAs")}</span>
				</Button>
			</Tooltip>
		</LabelMenu>
	);
}

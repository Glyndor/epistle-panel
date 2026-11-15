"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	LabelPanel,
	type LabelTarget,
} from "@/features/mail/components/label-menu/panel";

export type { LabelTarget };

/**
 * "Label as": the labels of one message or of a selection, in one dialog. The
 * control that opens it is the child, so the reader's toolbar draws it with
 * its words and a row of the list with an icon alone and a tooltip. The
 * dialog is the panel's own (`ui/dialog`): the focus goes to the field when it
 * opens, stays inside, and returns to the control when Escape or the close
 * button closes it; the list is on screen only while it is open, so a list of
 * fifty messages carries fifty closed controls and no list.
 *
 * It is a dialog and not a menu: a menu's items are not a place for a field,
 * which a menu would read its own typing for, and the list has tick boxes that
 * stay while the person chooses more than one.
 */
export function LabelMenu({
	targets,
	children,
}: {
	/** The messages to label and the labels each carries now. */
	targets: readonly LabelTarget[];
	/** The control that opens the dialog: a button. */
	children: ReactElement;
}) {
	const t = useTranslations("mail");

	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent
				closeLabel={t("labelClose")}
				className="max-w-sm gap-3 p-4"
			>
				<DialogHeader>
					<DialogTitle className="text-base">
						{t("labelAs")}
					</DialogTitle>
					<DialogDescription>
						{t("labelAsHint", { count: targets.length })}
					</DialogDescription>
				</DialogHeader>
				<LabelPanel targets={targets} />
			</DialogContent>
		</Dialog>
	);
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderInputIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { mailboxesQueryOptions } from "@/features/mail/queries/mail-query-options";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());

/**
 * "Move to": a menu of the account's folders with the current one checked.
 * Choosing another is a move. The menu is non-modal (see `ui/dropdown-menu`), so
 * it adds no style element.
 */
export function MoveMenu({
	current,
	disabled,
	onMove,
	defaultOpen = false,
}: {
	current: string | null;
	disabled: boolean;
	onMove: (box: string) => void;
	/** Open straight away, for a test; the reader never sets it. */
	defaultOpen?: boolean;
}) {
	const t = useTranslations("mail");
	const { data } = useQuery(mailboxesQueryOptions(fetchMailboxes));

	return (
		<DropdownMenu defaultOpen={defaultOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={disabled}
				>
					<FolderInputIcon aria-hidden="true" />
					{t("moveMenu")}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{t("moveTo")}</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={current ?? ""}
					onValueChange={(box) => {
						if (box !== current) {
							onMove(box);
						}
					}}
				>
					{(data ?? []).map((box) => (
						<DropdownMenuRadioItem key={box.id} value={box.id}>
							{box.role === null
								? box.name
								: t(`role_${box.role}`)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

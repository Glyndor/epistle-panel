"use client";

import { MoreHorizontalIcon, Trash2Icon, UserCogIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { loadDeleteDialog } from "@/features/accounts/components/account-row-actions/load-delete-dialog";
import { openLazily } from "@/features/accounts/components/account-row-actions/open-lazily";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { isAccountName } from "@/lib/api/account-name-pattern";

type DeleteDialog = Awaited<ReturnType<typeof loadDeleteDialog>>;

/**
 * The delete dialog is loaded the first time a menu opens, not with the list:
 * a page of accounts needs the alert dialog and its choices only when someone
 * deletes one. Opening the menu starts the download, so by the time the item
 * is chosen the code is most often there. Choosing the item waits for it
 * inside the handler, not in a Suspense of the page: a suspended page hides
 * the whole list, and a chunk that failed would take the page to its error
 * screen and, kept as a rejected promise, fail again on every retry. A failed
 * load says so in a message and asks again on the next press.
 */
/**
 * What can be done with one account, in a menu at the end of its row: open
 * it, and delete it when the API manages it. The menu's button is an icon
 * alone, so a tooltip names it; each action carries its icon. An account declared in the
 * configuration file says so in place of the delete action, since the API
 * cannot remove it. A name the pages would not accept gets no action that
 * would put it in an address or an API path.
 */
export function AccountRowActions({ row }: { row: AccountRow }) {
	const t = useTranslations("accounts");
	const routes = useAdminRoutes();
	/** The dialog once its code has arrived, and only while it is open. */
	const [dialog, setDialog] = useState<DeleteDialog | null>(null);
	// The page's `main`, found when the menu opens: the list is rendered there
	// so the table's scroll box does not clip it, and it stays inside a landmark.
	const [main, setMain] = useState<HTMLElement | null>(null);
	const named = isAccountName(row.name);
	/** The menu's button: where the focus returns when the delete dialog closes. */
	const trigger = useRef<HTMLButtonElement>(null);
	const Dialog = dialog;

	/** Wait for the dialog's code, and say so, without taking the page down, when it does not come. */
	const openDeleteDialog = () =>
		openLazily(
			loadDeleteDialog,
			(loaded) => setDialog(() => loaded),
			() => toast.error(t("deleteLoadFailed")),
		);

	return (
		<>
			<DropdownMenu
				onOpenChange={(open) => {
					if (open) {
						setMain(document.getElementById("main-content"));
						// A failure here is not the person's to hear: pressing the item asks again.
						loadDeleteDialog().catch(() => undefined);
					}
				}}
			>
				<DropdownMenuTrigger asChild>
					<Tooltip
						label={t("actionsFor", { name: row.name })}
						align="end"
					>
						<Button
							ref={trigger}
							variant="ghost"
							size="icon"
							aria-label={t("actionsFor", { name: row.name })}
						>
							<MoreHorizontalIcon aria-hidden="true" />
						</Button>
					</Tooltip>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" container={main}>
					{named ? (
						<DropdownMenuItem asChild>
							<Link href={routes.accountDetail(row.name)}>
								<UserCogIcon aria-hidden="true" />
								{t("open")}
							</Link>
						</DropdownMenuItem>
					) : null}
					{named && row.dynamic ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onSelect={() => void openDeleteDialog()}
							>
								<Trash2Icon aria-hidden="true" />
								{t("delete")}
							</DropdownMenuItem>
						</>
					) : (
						<DropdownMenuLabel>
							{t("managedInFile")}
						</DropdownMenuLabel>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{Dialog ? (
				<Dialog
					name={row.name}
					open
					onOpenChange={() => setDialog(null)}
					returnFocus={trigger}
				/>
			) : null}
		</>
	);
}

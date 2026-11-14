"use client";

import { PlusIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

/** The place of the form while its code is on its way. */
function FormLoading() {
	return (
		<div className="flex flex-col gap-4" aria-busy="true">
			<Skeleton className="h-14" />
			<Skeleton className="h-14" />
			<Skeleton className="h-24" />
			<Skeleton className="h-14" />
		</div>
	);
}

/**
 * The form is loaded when the dialog first opens, not with the page: the list
 * of accounts needs neither the form library nor the schemas until someone
 * creates an account.
 *
 * A dialog gives the focus to its first control at the moment it opens, and
 * on the first opening the form is not there yet: the focus went to the close
 * button and stayed on it. So the form is told to take the focus in its first
 * field when it arrives (`takeFocus`), on the first opening as on the next.
 */
const CreateAccountForm = dynamic(
	() =>
		import("@/features/accounts/components/create-account-form").then(
			(module) => module.CreateAccountForm,
		),
	{ loading: FormLoading },
);

/** The button that opens the new-account dialog, and the dialog. It closes itself once the account exists. */
export function CreateAccountDialog() {
	const t = useTranslations("accounts");
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon aria-hidden="true" />
					{t("create")}
				</Button>
			</DialogTrigger>
			<DialogContent closeLabel={t("close")}>
				<DialogHeader>
					<DialogTitle>{t("createTitle")}</DialogTitle>
					<DialogDescription>{t("createHelp")}</DialogDescription>
				</DialogHeader>
				<CreateAccountForm takeFocus onDone={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}

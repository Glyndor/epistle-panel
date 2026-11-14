import { useTranslations } from "next-intl";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Asks before an action that cannot be undone. The child is the control that
 * starts it (a button) and opens the dialog; `onConfirm` runs only when the
 * person confirms. Cancel takes the first focus, Escape closes without
 * acting, and the focus returns to the control.
 */
export function ConfirmAction({
	description,
	destructive = true,
	onConfirm,
	open,
	onOpenChange,
	children,
}: {
	/** What the action does, as a full sentence. */
	description: string;
	/** Whether the confirming button looks destructive; true by default. */
	destructive?: boolean;
	onConfirm: () => void;
	/**
	 * Controlled use: a key shortcut that must open the same dialog as the
	 * control does. Leave both out and the control opens it by itself.
	 */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactElement;
}) {
	const t = useTranslations("confirm");
	return (
		<AlertDialog
			{...(open === undefined ? {} : { open })}
			{...(onOpenChange === undefined ? {} : { onOpenChange })}
		>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("title")}</AlertDialogTitle>
					<AlertDialogDescription>
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
					<AlertDialogAction
						variant={destructive ? "destructive" : "default"}
						onClick={onConfirm}
					>
						{t("proceed")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

"use client";

import { FolderIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * The folder tree on a narrow screen: a button that opens it as a sheet (a
 * native modal `<dialog>`, which keeps focus inside and closes on Escape) and
 * closes it again once a folder is chosen. The tree arrives as `children`.
 */
export function FolderSheet({ children }: { children: React.ReactNode }) {
	const t = useTranslations("mail");
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				aria-haspopup="dialog"
				onClick={() => setOpen(true)}
			>
				<FolderIcon aria-hidden="true" />
				{t("folders")}
			</Button>
			<Sheet
				open={open}
				onOpenChange={setOpen}
				side="left"
				title={t("foldersTitle")}
				description={t("foldersDescription")}
				closeLabel={t("close")}
			>
				{/* A link followed inside the tree closes the sheet; the click is read here so the tree stays a server-rendered child. */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: a link inside is already operable by keyboard and its Enter fires this same click */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: the click only closes the sheet after a link inside it was followed; a link is already operable by keyboard and its Enter fires this same click */}
				<div
					onClick={(event) => {
						if ((event.target as HTMLElement).closest("a")) {
							setOpen(false);
						}
					}}
				>
					{children}
				</div>
			</Sheet>
		</>
	);
}

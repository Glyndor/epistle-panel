"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { mailboxesQueryOptions } from "@/features/mail/queries/mail-query-options";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());

/**
 * The folder the list is read from, when it is not the one of the page. The
 * folders are the ones the sidebar already asked for, so the list is the same
 * one and nothing is asked twice.
 *
 * The choice is the browser's own: it works before any script has loaded and
 * inside a plain GET form, which is where a menu of the panel's own cannot be
 * used. The folder the address names is in the list even before the folders
 * are read, so a search that names one does not lose it.
 */
export function FolderPicker({ value }: { value: string }) {
	const t = useTranslations("mail");
	const { data } = useQuery(mailboxesQueryOptions(fetchMailboxes));
	const boxes = data ?? [];
	const known = boxes.some((box) => box.id === value);

	return (
		<NativeSelect
			id="mail-condition-folder"
			name="folder"
			defaultValue={value}
		>
			<NativeSelectOption value="">
				{t("conditionFolderHere")}
			</NativeSelectOption>
			{known ? null : (
				<NativeSelectOption value={value}>{value}</NativeSelectOption>
			)}
			{boxes.map((box) => (
				<NativeSelectOption key={box.id} value={box.id}>
					{box.name}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}

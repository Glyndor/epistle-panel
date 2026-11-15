"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { MAIL_REFRESH_MS } from "@/features/mail/queries/mail-query-keys";
import { mailboxesQueryOptions } from "@/features/mail/queries/mail-query-options";
import { useRefreshInterval } from "@/features/refresh/components/refresh-provider";
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
	const refreshMs = useRefreshInterval(MAIL_REFRESH_MS);
	const { data } = useQuery(mailboxesQueryOptions(fetchMailboxes, refreshMs));
	const boxes = data ?? [];
	// The folder the address names is in the list even before the folders are
	// read, so a search that names one does not lose it. A search that names
	// none has nothing to add: the first option already says it.
	const named = value !== "" && !boxes.some((box) => box.id === value);

	return (
		<NativeSelect
			id="mail-condition-folder"
			name="folder"
			defaultValue={value}
		>
			<NativeSelectOption value="">
				{t("conditionFolderHere")}
			</NativeSelectOption>
			{named ? (
				<NativeSelectOption value={value}>{value}</NativeSelectOption>
			) : null}
			{boxes.map((box) => (
				<NativeSelectOption key={box.id} value={box.id}>
					{box.name}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}

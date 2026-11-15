"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo } from "react";

import { NavSection } from "@/components/layout/nav-section";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { useLoadedMail } from "@/features/mail/components/labels-nav/use-loaded-mail";
import { labelKey } from "@/features/mail/labels/keyword-codec";
import type { LabelTone } from "@/features/mail/labels/label-tone";
import {
	collectSidebarLabels,
	type SidebarLabel,
} from "@/features/mail/labels/sidebar-selection";
import { activeFolder } from "@/features/mail/links/active-folder";
import { labelHref } from "@/features/mail/links/label-href";
import { cn } from "@/lib/class-names";

/**
 * The dot of each tone, written out for the reason `label-chip` writes its
 * own: a class built from the number is a class the stylesheet never holds.
 * The dot is a shape of the tone and an `svg`, since the sidebar's entry
 * keeps its direct `svg` at the size of an icon and its direct `span`s out of
 * the rail, and a dot that is a `span` would be taken away with the name.
 */
const TONE_FILL = {
	1: "fill-label-1",
	2: "fill-label-2",
	3: "fill-label-3",
	4: "fill-label-4",
	5: "fill-label-5",
	6: "fill-label-6",
	7: "fill-label-7",
	8: "fill-label-8",
} as const satisfies Record<LabelTone, string>;

/**
 * The labels of the latest messages, in the mail area's sidebar, under a
 * heading that opens and closes them: one link per label, with the dot of its
 * tone, that opens the messages of the folder the person is in that carry it.
 * Collapsed to icons a label is its dot and a tooltip says its name.
 *
 * The list is the labels of the messages the browser has loaded (the pages of
 * the folders the person opened, and their refreshes), not of the whole
 * account: the mail server can neither filter by keyword nor look across
 * folders yet (Glyndor/epistle#1790), and asking it for the newest messages
 * of every folder just to fill the sidebar is a cost no page asked for. The
 * heading says so, and a description for assistive technology says it in a
 * sentence. With no label in what is loaded the group is not drawn at all.
 *
 * A label's name is text of a message: it is isolated with `bdi`, cut with an
 * ellipsis when it does not fit and never changed. The label the list is
 * narrowed by is the current entry and is still drawn with the group closed.
 */
export function LabelsNav() {
	const t = useTranslations("mail");
	const tNav = useTranslations("nav");
	const hint = useId();
	const pathname = usePathname();
	const wanted = useSearchParams().get("label");
	const { pages, boxes } = useLoadedMail();
	const labels = useMemo(() => collectSidebarLabels(pages), [pages]);
	if (labels.length === 0) {
		return null;
	}
	const activeId = activeFolder(pathname, boxes ?? []);

	// Only on the page of a folder: the composer narrows nothing.
	const isCurrent = (label: SidebarLabel) =>
		activeId !== null &&
		wanted !== null &&
		labelKey(wanted) === labelKey(label.keyword);

	const entry = (label: SidebarLabel) => {
		const active = isCurrent(label);
		return (
			<SidebarMenuItem key={label.keyword}>
				<SidebarMenuButton
					asChild
					isActive={active}
					tooltip={
						active
							? tNav("currentEntry", { name: label.name })
							: label.name
					}
				>
					<Link
						href={labelHref(label.keyword, activeId, boxes)}
						aria-current={active ? "page" : undefined}
					>
						<svg
							aria-hidden="true"
							focusable="false"
							viewBox="0 0 16 16"
							className={cn(
								"forced-color-adjust-none",
								TONE_FILL[label.tone],
							)}
						>
							<circle cx="8" cy="8" r="4" />
						</svg>
						<span className="min-w-0 flex-1 truncate">
							<bdi>{label.name}</bdi>
						</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	};
	const current = labels.find(isCurrent);

	return (
		<nav aria-label={t("labelsNav")} data-slot="labels-nav">
			<NavSection
				id="labels"
				label={t("labelsNav")}
				current={
					current === undefined ? undefined : (
						<SidebarMenu>{entry(current)}</SidebarMenu>
					)
				}
			>
				<p id={hint} className="sr-only">
					{t("labelsNavHint")}
				</p>
				<SidebarMenu aria-describedby={hint}>
					{labels.map(entry)}
				</SidebarMenu>
			</NavSection>
		</nav>
	);
}

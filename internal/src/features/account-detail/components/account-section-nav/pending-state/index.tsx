"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";

export type PendingSectionChange = (section: Section | null) => void;

export function PendingSectionState({
	section,
	pending,
	onPending,
}: {
	section: Section;
	pending: boolean;
	onPending: PendingSectionChange;
}) {
	useEffect(() => {
		onPending(pending ? section : null);
	}, [onPending, pending, section]);

	return pending ? (
		<span
			aria-hidden="true"
			data-pending="true"
			className="ml-1 inline-flex size-4 items-center justify-center font-semibold"
		>
			…
		</span>
	) : null;
}

export function LinkPendingState({
	section,
	onPending,
}: {
	section: Section;
	onPending: PendingSectionChange;
}) {
	const { pending } = useLinkStatus();
	return (
		<PendingSectionState
			section={section}
			pending={pending}
			onPending={onPending}
		/>
	);
}

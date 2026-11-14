"use client";

import Link from "next/link";
import { listMemory } from "@/features/mail/components/message-list/list-memory";

/** Remember the removed words in the browser; the server supplies the link. */
export function ClearSearchLink({
	children,
	...props
}: Omit<React.ComponentProps<typeof Link>, "onClick">) {
	return (
		<Link
			{...props}
			onClick={() => {
				listMemory.chips = "q";
			}}
		>
			{children}
		</Link>
	);
}

import type { ReactNode } from "react";

import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";

export type AccountSectionProps =
	| { section: "overview"; account: AccountRow }
	| { section: "profile"; account: AccountRow }
	| { section: "security"; account: AccountRow; name: string }
	| { section: "mailboxes"; name: string }
	| { section: "masked"; name: string }
	| { section: "archive"; name: string };

export type AccountSectionRenderer = (props: AccountSectionProps) => ReactNode;

export type AccountSectionLoader = (
	section: Section,
	attempt: number,
) => Promise<AccountSectionRenderer>;

export const loadAccountSection: AccountSectionLoader = async (section) => {
	switch (section) {
		case "overview": {
			const module = await import(
				"@/features/account-detail/components/overview-section"
			);
			return module.OverviewSection as unknown as AccountSectionRenderer;
		}
		case "profile": {
			const module = await import(
				"@/features/account-detail/components/profile-section"
			);
			return module.ProfileSection as unknown as AccountSectionRenderer;
		}
		case "security": {
			const module = await import(
				"@/features/account-detail/components/security-section"
			);
			return module.SecuritySection as unknown as AccountSectionRenderer;
		}
		case "mailboxes": {
			const module = await import(
				"@/features/account-detail/components/mailboxes-section"
			);
			return module.MailboxesSection as unknown as AccountSectionRenderer;
		}
		case "masked": {
			const module = await import(
				"@/features/account-detail/components/masked-section"
			);
			return module.MaskedSection as unknown as AccountSectionRenderer;
		}
		case "archive": {
			const module = await import(
				"@/features/account-detail/components/archive-section"
			);
			return module.ArchiveSection as unknown as AccountSectionRenderer;
		}
	}
};

import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";

export function AccountDetailSkeleton({
	section = "overview",
}: {
	section?: Section;
}) {
	const t = useTranslations("table");
	return (
		<div className="flex w-full flex-col gap-4">
			<p className="sr-only" role="status">
				{t("loading")}
			</p>
			<div
				aria-busy="true"
				data-testid={`account-skeleton-${section}`}
				className="flex w-full flex-col gap-4"
			>
				<SectionSkeleton section={section} />
			</div>
		</div>
	);
}

function SectionSkeleton({ section }: { section: Section }) {
	switch (section) {
		case "overview":
			return <OverviewSkeleton />;
		case "profile":
			return <ProfileSkeleton />;
		case "security":
			return <SecuritySkeleton />;
		case "mailboxes":
			return <MailboxesSkeleton />;
		case "masked":
			return <MaskedSkeleton />;
		case "archive":
			return <ArchiveSkeleton />;
	}
}

function OverviewSkeleton() {
	return (
		<Card
			aria-hidden="true"
			className="h-[172px] justify-between overflow-hidden"
		>
			<Skeleton className="h-6 w-40 rounded-md" />
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Skeleton className="h-5 w-24 rounded-md" />
					<Skeleton className="h-5 w-56 rounded-md" />
				</div>
				<div className="flex flex-col gap-1">
					<Skeleton className="h-5 w-20 rounded-md" />
					<Skeleton className="h-5 w-36 rounded-md" />
				</div>
			</div>
		</Card>
	);
}

function ProfileSkeleton() {
	return (
		<Card
			aria-hidden="true"
			className="h-[210px] justify-between overflow-hidden sm:h-[194px]"
		>
			<Skeleton className="h-6 w-28 rounded-md" />
			<div className="flex flex-col gap-2">
				<Skeleton className="h-5 w-28 rounded-md" />
				<Skeleton className="h-9 w-full rounded-lg" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-3/4 rounded-md sm:hidden" />
				<Skeleton className="h-8 w-28 rounded-lg" />
			</div>
		</Card>
	);
}

function SecuritySkeleton() {
	return (
		<>
			<Card
				aria-hidden="true"
				className="h-[234px] justify-between overflow-hidden sm:h-[194px]"
			>
				<div className="flex flex-col gap-2">
					<Skeleton className="h-6 w-32 rounded-md" />
					<Skeleton className="h-4 w-full rounded-md" />
					<Skeleton className="h-4 w-full rounded-md sm:hidden" />
					<Skeleton className="h-4 w-3/4 rounded-md sm:hidden" />
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-5 w-24 rounded-md" />
					<Skeleton className="h-9 w-full rounded-lg" />
					<Skeleton className="h-8 w-36 rounded-lg" />
				</div>
			</Card>
			<Card
				aria-hidden="true"
				className="h-[204px] justify-between overflow-hidden sm:h-[144px]"
			>
				<div className="flex flex-col gap-2">
					<Skeleton className="h-6 w-48 rounded-md" />
					<Skeleton className="h-4 w-full rounded-md" />
					<Skeleton className="h-4 w-full rounded-md sm:hidden" />
					<Skeleton className="h-4 w-5/6 rounded-md sm:hidden" />
					<Skeleton className="h-4 w-3/4 rounded-md sm:hidden" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-36 rounded-lg" />
					<Skeleton className="h-8 w-24 rounded-lg" />
				</div>
			</Card>
		</>
	);
}

function MailboxesSkeleton() {
	return (
		<Card
			aria-hidden="true"
			className="h-[136px] justify-between overflow-hidden"
		>
			<Skeleton className="h-6 w-32 rounded-md" />
			<div className="flex flex-col gap-1">
				<Skeleton className="h-5 w-28 rounded-md" />
				<Skeleton className="h-5 w-20 rounded-md" />
				<Skeleton className="h-5 w-24 rounded-md" />
			</div>
		</Card>
	);
}

function MaskedSkeleton() {
	return (
		<Card
			aria-hidden="true"
			className="h-[270px] justify-between overflow-hidden sm:h-[250px]"
		>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-6 w-40 rounded-md" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-3/4 rounded-md sm:hidden" />
			</div>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-20 rounded-md" />
				<Skeleton className="h-9 w-full rounded-lg" />
				<Skeleton className="h-8 w-24 rounded-lg" />
			</div>
		</Card>
	);
}

function ArchiveSkeleton() {
	return (
		<Card
			aria-hidden="true"
			className="h-[292px] justify-between overflow-hidden sm:h-[176px]"
		>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-6 w-24 rounded-md" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-3/4 rounded-md sm:hidden" />
			</div>
			<div className="flex flex-col gap-2">
				<div className="flex h-16 flex-col justify-between gap-2 sm:h-6 sm:flex-row sm:items-center">
					<Skeleton className="h-4 w-3/4 rounded-md" />
					<Skeleton className="h-8 w-20 rounded-lg" />
				</div>
				<div className="flex h-16 flex-col justify-between gap-2 sm:h-6 sm:flex-row sm:items-center">
					<Skeleton className="h-4 w-2/3 rounded-md" />
					<Skeleton className="h-8 w-20 rounded-lg" />
				</div>
			</div>
		</Card>
	);
}

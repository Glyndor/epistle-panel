"use client";

import { ListFilterIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** A translated group of filter choices; the caller owns their state. */
interface FilterGroup {
	id: string;
	label: string;
	options: readonly {
		value: string;
		label: string;
		checked: boolean;
		onToggle: () => void;
	}[];
}

/** Shared filter presentation, with optional menu content before the clear action. */
export function FilterMenu({
	label,
	activeLabel,
	clearLabel,
	active,
	groups,
	onClear,
	children,
}: {
	label: string;
	activeLabel: string;
	clearLabel: string;
	active: number;
	groups: readonly FilterGroup[];
	onClear: () => void;
	children?: React.ReactNode;
}) {
	const id = useId();
	const [main, setMain] = useState<HTMLElement | null>(null);

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open) {
					setMain(document.getElementById("main-content"));
				}
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">
					<ListFilterIcon aria-hidden="true" />
					{label}
					{active > 0 ? (
						<>
							<Badge variant="default" aria-hidden="true">
								{active}
							</Badge>
							<span className="sr-only">{activeLabel}</span>
						</>
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" container={main}>
				{groups.map((facet) => (
					<DropdownMenuGroup
						key={facet.id}
						aria-labelledby={`${id}-${facet.id}`}
					>
						<DropdownMenuLabel id={`${id}-${facet.id}`}>
							{facet.label}
						</DropdownMenuLabel>
						{facet.options.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={option.checked}
								onCheckedChange={option.onToggle}
								onSelect={(event) => event.preventDefault()}
							>
								{option.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuGroup>
				))}
				{children}
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled={active === 0} onSelect={onClear}>
					{clearLabel}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

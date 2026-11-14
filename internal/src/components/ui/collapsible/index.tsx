"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import type * as React from "react";

/**
 * A part of the page that opens and closes under a button. The button says
 * whether it is open (`aria-expanded`) and what it controls; the content is
 * out of the page while closed.
 */
function Collapsible(
	props: React.ComponentProps<typeof CollapsiblePrimitive.Root>,
) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

/** The button that opens and closes it. */
function CollapsibleTrigger(
	props: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>,
) {
	return (
		<CollapsiblePrimitive.CollapsibleTrigger
			data-slot="collapsible-trigger"
			{...props}
		/>
	);
}

/** What opens and closes. */
function CollapsibleContent(
	props: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>,
) {
	return (
		<CollapsiblePrimitive.CollapsibleContent
			data-slot="collapsible-content"
			{...props}
		/>
	);
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };

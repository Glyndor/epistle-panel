import { screen } from "@testing-library/react";

import { useKeptFocus } from "@/features/mail/components/message-list/use-kept-focus";

/**
 * A list with the parts `useKeptFocus` looks for, for its tests: the box that
 * scrolls, rows, their link and their two marks, the notice of the empty
 * list, and a control outside the list.
 */
export function RowList({
	ids,
	redrawn = false,
	settled = true,
	address = "inbox",
}: {
	ids: readonly string[];
	/** Whether the list has its messages, or is still on its way. */
	settled?: boolean;
	/** Draw the rows again whenever the first one changes, as a group keyed by its first row did. */
	redrawn?: boolean;
	/** What names the list: folder, page, filter and search. */
	address?: string;
}) {
	const focus = useKeptFocus(ids, settled, address);
	return (
		<>
			<div data-list-scroller="" data-testid="scroller">
				<div ref={focus.list}>
					<h2>Messages</h2>
					{ids.length === 0 ? (
						<div ref={focus.empty} tabIndex={-1}>
							nothing here
						</div>
					) : null}
					<ul key={redrawn ? ids[0] : "list"}>
						{ids.map((id) => (
							<li key={id} data-slot="message-row">
								<a href={`#${id}`} data-message-id={id}>
									open {id}
								</a>
								<button type="button" data-mark="important">
									important {id}
								</button>
								<button type="button" data-mark="star">
									star {id}
								</button>
							</li>
						))}
					</ul>
				</div>
			</div>
			<button type="button">outside</button>
		</>
	);
}

/** A control of the list by its name: "open b", "star b", "important b", "outside". */
export const control = (name: string) =>
	screen.getByRole(name.startsWith("open") ? "link" : "button", { name });

/** The box of the list that scrolls. */
export const scroller = () => screen.getByTestId("scroller");

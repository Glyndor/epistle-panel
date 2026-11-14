import type { AddressView } from "@/features/mail/schemas/mail-view";

/**
 * The addresses of one header as text, with a comma between them and the
 * name first when there is one. Both parts are text from the message, so
 * each address stands in its own `<bdi>`.
 */
export function Addresses({ list }: { list: readonly AddressView[] }) {
	return (
		<>
			{list.map((address, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: the same address can be listed twice and the list never reorders
				<span key={`${address.email}-${index}`}>
					{index > 0 ? ", " : null}
					<bdi>
						{address.name === null
							? address.email
							: `${address.name} <${address.email}>`}
					</bdi>
				</span>
			))}
		</>
	);
}

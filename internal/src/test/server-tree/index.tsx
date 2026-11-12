import { cloneElement, isValidElement, type ReactNode } from "react";

/**
 * Run the async (Server) components in a React tree and leave the rest alone,
 * so the result renders in happy-dom, which cannot render an async component.
 * Only a component declared `async` is called; client components and plain
 * elements keep their place and have their children resolved in turn.
 */
export async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
	if (Array.isArray(node)) {
		const resolved = await Promise.all(node.map(resolveServerTree));
		// A rebuilt element is no longer marked as statically placed, so give
		// each one the key React would otherwise ask for.
		return resolved.map((child, index) =>
			isValidElement(child) && child.key === null
				? // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt once and never reordered.
					cloneElement(child, { key: index })
				: child,
		);
	}
	if (!isValidElement<{ children?: ReactNode }>(node)) {
		return node;
	}
	const { type, props } = node;
	if (
		typeof type === "function" &&
		type.constructor.name === "AsyncFunction"
	) {
		const render = type as (props: unknown) => Promise<ReactNode>;
		return resolveServerTree(await render(props));
	}
	if (props.children === undefined) {
		return node;
	}
	return cloneElement(
		node,
		undefined,
		await resolveServerTree(props.children),
	);
}

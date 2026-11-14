import { cloneElement, isValidElement, type ReactNode, Suspense } from "react";

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

/**
 * What a frame streams first when its boundaries sit below server components
 * of its own: the async components outside every `Suspense` boundary are run,
 * and each boundary gives way to its fallback (resolved the same way) without
 * anything inside it being run. {@link firstPaint} alone sees only the
 * boundaries already in the tree it is given.
 */
export async function resolveFirstPaint(node: ReactNode): Promise<ReactNode> {
	if (Array.isArray(node)) {
		const resolved = await Promise.all(node.map(resolveFirstPaint));
		return resolved.map((child, index) =>
			isValidElement(child) && child.key === null
				? // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt once and never reordered.
					cloneElement(child, { key: index })
				: child,
		);
	}
	if (!isValidElement<{ children?: ReactNode; fallback?: ReactNode }>(node)) {
		return node;
	}
	const { type, props } = node;
	if (type === Suspense) {
		return resolveFirstPaint(props.fallback ?? null);
	}
	if (
		typeof type === "function" &&
		type.constructor.name === "AsyncFunction"
	) {
		const render = type as (props: unknown) => Promise<ReactNode>;
		return resolveFirstPaint(await render(props));
	}
	if (props.children === undefined) {
		return node;
	}
	return cloneElement(
		node,
		undefined,
		await resolveFirstPaint(props.children),
	);
}

/**
 * What a page streams first: every `Suspense` boundary replaced by its
 * fallback, without running anything inside it. A test renders this to assert
 * the frame and the skeleton that paint before the slow part answers.
 */
export function firstPaint(node: ReactNode): ReactNode {
	if (Array.isArray(node)) {
		return node.map((child, index) => {
			const resolved = firstPaint(child);
			return isValidElement(resolved) && resolved.key === null
				? // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt once and never reordered.
					cloneElement(resolved, { key: index })
				: resolved;
		});
	}
	if (!isValidElement<{ children?: ReactNode; fallback?: ReactNode }>(node)) {
		return node;
	}
	if (node.type === Suspense) {
		return node.props.fallback ?? null;
	}
	if (node.props.children === undefined) {
		return node;
	}
	return cloneElement(node, undefined, firstPaint(node.props.children));
}

import { isValidElement } from "react";

/**
 * Check the tree produced by a server component before executing client
 * leaves. DOM rendering accepts handlers here; the RSC boundary does not.
 * Children are inspected too, even when passed through a client wrapper.
 */
export function assertServerProps(value: unknown, path = "tree"): void {
	if (typeof value === "function") {
		throw new Error(`Function prop from server at ${path}`);
	}
	if (isValidElement(value)) {
		assertServerProps(value.props, `${path}.props`);
	} else if (Array.isArray(value)) {
		value.forEach((child, index) => {
			assertServerProps(child, `${path}[${index}]`);
		});
	} else if (value !== null && typeof value === "object") {
		for (const [name, prop] of Object.entries(value)) {
			assertServerProps(prop, `${path}.${name}`);
		}
	}
}

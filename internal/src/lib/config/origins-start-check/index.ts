import "server-only";

import { readOperatorBrandOrigin } from "../brand-origin";
import {
	builtStaticOrigin,
	readOperatorStaticOrigin,
	STATIC_ORIGIN_VARIABLE,
} from "../static-origin";

/**
 * Settle the two origin variables at start. An unusable value stops the server
 * with a message that names the variable.
 *
 * The static origin has one more rule. It is compiled into the build, so what
 * the operator sets now must be what the build used: a server that kept running
 * with another value would write a policy that does not match the files its
 * markup points to, and the page would load with nothing in it. Unset on both
 * sides is the panel serving its own files, and it passes.
 */
export function checkOriginsAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	const problem = originsProblem();
	if (problem !== null) {
		fail(problem);
	}
}

/** What is wrong with the two variables, or `null` when nothing is. */
function originsProblem(): string | null {
	try {
		readOperatorBrandOrigin();
		const operator = readOperatorStaticOrigin();
		const built = builtStaticOrigin();
		if (operator === built) {
			return null;
		}
		if (operator === null) {
			return `${STATIC_ORIGIN_VARIABLE} is not set, but this build serves its static files from another origin`;
		}
		return built === null
			? `${STATIC_ORIGIN_VARIABLE} is set, but this build serves its static files itself: the variable is read when the image is built`
			: `${STATIC_ORIGIN_VARIABLE} is not the origin this build serves its static files from`;
	} catch (error) {
		return error instanceof Error
			? error.message
			: "the content delivery origins are not usable";
	}
}

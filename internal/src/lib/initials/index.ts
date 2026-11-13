/** The first letter or digit of a word, whole even when it is not one UTF-16 unit. */
function first(word: string | undefined): string {
	return word === undefined ? "" : (Array.from(word)[0] ?? "");
}

/**
 * Up to two characters that stand for a name in its avatar: the first letter
 * of its first and of its last word, upper case. Words are runs of letters and
 * digits, so `jose.caro` is `JC` and `admin` is `A`. A name with no letter or
 * digit is `?`. The result is text for the page, never markup: nothing but
 * letters and digits can come out of it.
 */
export function initials(name: string): string {
	const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
	const letters =
		words.length > 1
			? first(words[0]) + first(words.at(-1))
			: first(words[0]);
	return letters === "" ? "?" : letters.toLocaleUpperCase();
}

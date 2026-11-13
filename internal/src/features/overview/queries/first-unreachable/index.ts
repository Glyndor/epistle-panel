/**
 * Whether any read of a page failed, known as early as it can be: `true` at
 * the first read that says so, `false` once every one has said it did not.
 * The notice of a page waits on this and not on all its reads, so one slow
 * answer does not hold back the news that another already failed.
 *
 * A read that rejects counts as failed. With no read there is nothing to fail.
 */
export function firstUnreachable(
	reads: readonly Promise<boolean>[],
): Promise<boolean> {
	return new Promise((resolve) => {
		let waiting = reads.length;
		if (waiting === 0) {
			resolve(false);
		}
		for (const read of reads) {
			read.then(
				(unreachable) => {
					waiting -= 1;
					if (unreachable) {
						resolve(true);
					} else if (waiting === 0) {
						resolve(false);
					}
				},
				() => resolve(true),
			);
		}
	});
}

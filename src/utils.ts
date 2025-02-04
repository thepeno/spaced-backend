export function redactEmail(email: string): string {
	const [localPart, domain] = email.split('@');
	if (!domain || localPart.length < 2) return email;

	const first = localPart[0];
	const last = '*'.repeat(Math.max(0, localPart.length - 1));

	return `${first}${last}@${domain}`;
}

/**
 * Asserts that an array is non-empty.
 * @param arr - The array to check.
 * @throws An error if the array is empty.
 */
export function assertNonEmpty<T>(arr: T[]): asserts arr is [T, ...T[]] {
	if (arr.length === 0) {
		throw new Error('Array must have at least one element');
	}
}

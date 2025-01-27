export function redactEmail(email: string): string {
	const [localPart, domain] = email.split('@');
	if (!domain || localPart.length < 2) return email;

	const first = localPart[0];
	const last = '*'.repeat(Math.max(0, localPart.length - 1));

	return `${first}${last}@${domain}`;
}

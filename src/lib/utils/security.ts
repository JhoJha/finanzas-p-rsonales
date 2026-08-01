import type { Settings } from '$lib/schema';

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return toBase64(new Uint8Array(digest));
}

export async function createPinSecurity(pin: string): Promise<NonNullable<Settings['security']>> {
	const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
	return { pinSalt: salt, pinHash: await sha256(`${salt}:${pin}`) };
}

export async function verifyPin(pin: string, security: NonNullable<Settings['security']>): Promise<boolean> {
	return (await sha256(`${security.pinSalt}:${pin}`)) === security.pinHash;
}

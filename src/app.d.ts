// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface NostrEvent {
		id?: string;
		pubkey?: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
		sig?: string;
	}

	interface Window {
		nostr?: {
			getPublicKey: () => Promise<string>;
			signEvent: (event: NostrEvent) => Promise<NostrEvent>;
			_fake?: boolean;
		};
	}
}

export {};

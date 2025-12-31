import { SimplePool, nip19, type Event } from 'nostr-tools';

const DEFAULT_RELAYS = [
	'wss://relay.damus.io',
	'wss://relay.nostr.band',
	'wss://nos.lol',
	'wss://relay.primal.net'
];

let pool: SimplePool | null = null;

function getPool(): SimplePool {
	if (!pool) {
		pool = new SimplePool();
	}
	return pool;
}

export interface UserProfile {
	pubkey: string;
	npub: string;
	name?: string;
	display_name?: string;
	picture?: string;
	about?: string;
	contactsCount: number;
	lastUpdated?: string;
}

export async function fetchUserProfile(pubkeyHex: string): Promise<UserProfile> {
	const p = getPool();

	// Fetch profile metadata (kind 0) and contacts (kind 3) in parallel
	const [profileEvent, contactsEvent] = await Promise.all([
		p.get(DEFAULT_RELAYS, { kinds: [0], authors: [pubkeyHex] }),
		p.get(DEFAULT_RELAYS, { kinds: [3], authors: [pubkeyHex] })
	]);

	const profile: UserProfile = {
		pubkey: pubkeyHex,
		npub: nip19.npubEncode(pubkeyHex),
		contactsCount: 0
	};

	// Parse profile metadata
	if (profileEvent) {
		try {
			const metadata = JSON.parse(profileEvent.content);
			profile.name = metadata.name || metadata.display_name;
			profile.display_name = metadata.display_name;
			profile.picture = metadata.picture;
			profile.about = metadata.about;
		} catch (error) {
			console.error('Error parsing profile metadata:', error);
		}
	}

	// Parse contacts
	if (contactsEvent) {
		const contacts = contactsEvent.tags.filter(tag => tag[0] === 'p');
		profile.contactsCount = contacts.length;
		profile.lastUpdated = new Date(contactsEvent.created_at * 1000).toLocaleString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	return profile;
}

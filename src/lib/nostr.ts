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

export async function fetchContactList(pubkeyHex: string): Promise<string[]> {
	const p = getPool();

	const contactsEvent = await p.get(DEFAULT_RELAYS, {
		kinds: [3],
		authors: [pubkeyHex]
	});

	if (!contactsEvent) {
		return [];
	}

	return contactsEvent.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
}

export interface ContactProfile {
	pubkey: string;
	npub: string;
	name?: string;
	display_name?: string;
	picture?: string;
	about?: string;
}

export async function fetchMultipleProfiles(pubkeyHexes: string[]): Promise<Map<string, ContactProfile>> {
	const p = getPool();
	const profiles = new Map<string, ContactProfile>();

	// Initialize with default profiles
	pubkeyHexes.forEach(pubkey => {
		profiles.set(pubkey, {
			pubkey,
			npub: nip19.npubEncode(pubkey)
		});
	});

	if (pubkeyHexes.length === 0) {
		return profiles;
	}

	try {
		const events = await p.querySync(DEFAULT_RELAYS, {
			kinds: [0],
			authors: pubkeyHexes
		});

		events.forEach(event => {
			try {
				const metadata = JSON.parse(event.content);
				profiles.set(event.pubkey, {
					pubkey: event.pubkey,
					npub: nip19.npubEncode(event.pubkey),
					name: metadata.name,
					display_name: metadata.display_name,
					picture: metadata.picture,
					about: metadata.about
				});
			} catch (error) {
				console.error('Error parsing metadata for', event.pubkey, error);
			}
		});
	} catch (error) {
		console.error('Error fetching profiles:', error);
	}

	return profiles;
}

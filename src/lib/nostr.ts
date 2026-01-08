import { SimplePool, nip19, type Event } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';

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

async function fetchUserWriteRelays(userPubkey: string): Promise<string[]> {
	const p = getPool();

	try {
		// Fetch user's relay list (kind 10002 - NIP-65)
		const relayListEvent = await p.get(DEFAULT_RELAYS, {
			kinds: [10002],
			authors: [userPubkey]
		});

		if (!relayListEvent) {
			return [];
		}

		// Extract write relays
		const writeRelays: string[] = [];
		relayListEvent.tags.forEach(tag => {
			if (tag[0] === 'r') {
				const relayUrl = tag[1];
				const marker = tag[2]; // 'read', 'write', or undefined (both)

				// Include if it's a write relay or no marker specified (means both)
				if (!marker || marker === 'write') {
					writeRelays.push(relayUrl);
				}
			}
		});

		return writeRelays;
	} catch (error) {
		console.error('Error fetching user relay list:', error);
		return [];
	}
}

export async function updateContactList(
	userPubkey: string,
	contactPubkeys: string[]
): Promise<void> {
	const p = getPool();

	// Fetch user's write relays
	const userWriteRelays = await fetchUserWriteRelays(userPubkey);

	// Combine user's write relays with defaults (user's relays first)
	const allRelays = userWriteRelays.length > 0
		? [...userWriteRelays, ...DEFAULT_RELAYS]
		: DEFAULT_RELAYS;

	// Normalize and remove duplicates
	const normalizedRelays = allRelays.map(url => normalizeURL(url));
	const uniqueRelays = [...new Set(normalizedRelays)];

	// Create kind 3 event
	const event = {
		kind: 3,
		created_at: Math.floor(Date.now() / 1000),
		tags: contactPubkeys.map(pubkey => ['p', pubkey]),
		content: '',
		pubkey: userPubkey
	};

	// Sign event using window.nostr
	if (!window.nostr) {
		throw new Error('Nostr extension not available');
	}

	const signedEvent = await window.nostr.signEvent(event);

	// Ensure the signed event has required fields
	if (!signedEvent.pubkey || !signedEvent.id || !signedEvent.sig) {
		throw new Error('Invalid signed event');
	}

	// Publish to relays
	const publishPromises = p.publish(uniqueRelays, signedEvent as Event);

	// Wait for at least one relay to confirm
	await Promise.race(publishPromises);
}

export interface InteractionScore {
	pubkey: string;
	score: number;
	replies: number;
	reactions: number;
	reposts: number;
	zaps: number;
}

function extractZapAmount(event: Event): number {
	// Try to get amount from "amount" tag (in millisats)
	const amountTag = event.tags.find(tag => tag[0] === 'amount');
	if (amountTag && amountTag[1]) {
		const millisats = parseInt(amountTag[1], 10);
		return Math.floor(millisats / 1000); // Convert to sats
	}

	// Try to parse from description tag
	const descriptionTag = event.tags.find(tag => tag[0] === 'description');
	if (descriptionTag && descriptionTag[1]) {
		try {
			const zapRequest = JSON.parse(descriptionTag[1]);
			if (zapRequest.tags) {
				const amountTagInRequest = zapRequest.tags.find((tag: string[]) => tag[0] === 'amount');
				if (amountTagInRequest && amountTagInRequest[1]) {
					const millisats = parseInt(amountTagInRequest[1], 10);
					return Math.floor(millisats / 1000); // Convert to sats
				}
			}
		} catch (error) {
			// Failed to parse description
		}
	}

	return 0;
}

export async function calculateInteractionScores(
	targetUserPubkey: string,
	contactPubkeys: string[],
	daysBack: number = 30
): Promise<Map<string, InteractionScore>> {
	const p = getPool();
	const scores = new Map<string, RelevanceScore>();

	// Initialize scores
	contactPubkeys.forEach(pubkey => {
		scores.set(pubkey, {
			pubkey,
			score: 0,
			replies: 0,
			reactions: 0,
			reposts: 0,
			zaps: 0
		});
	});

	if (contactPubkeys.length === 0) {
		return scores;
	}

	const now = Math.floor(Date.now() / 1000);
	const since = now - (daysBack * 24 * 60 * 60);

	try {
		// Fetch target user's write relays
		const targetWriteRelays = await fetchUserWriteRelays(targetUserPubkey);

		// Combine target's write relays with defaults
		const allRelays = targetWriteRelays.length > 0
			? [...targetWriteRelays, ...DEFAULT_RELAYS]
			: DEFAULT_RELAYS;

		// Normalize and remove duplicates
		const normalizedRelays = allRelays.map(url => normalizeURL(url));
		const queryRelays = [...new Set(normalizedRelays)];

		// Fetch target user's interactions with contacts in parallel
		const [mentionEvents, reactionEvents, repostEvents, zapEvents] = await Promise.all([
			// Mentions/Replies: kind 1 from target user mentioning contacts
			p.querySync(queryRelays, {
				kinds: [1],
				authors: [targetUserPubkey],
				'#p': contactPubkeys,
				since
			}),
			// Reactions: kind 7 from target user
			p.querySync(queryRelays, {
				kinds: [7],
				authors: [targetUserPubkey],
				since
			}),
			// Reposts: kind 6 from target user
			p.querySync(queryRelays, {
				kinds: [6],
				authors: [targetUserPubkey],
				since
			}),
			// Zaps: kind 9735 where target user is the sender
			p.querySync(queryRelays, {
				kinds: [9735],
				'#p': contactPubkeys,
				since
			})
		]);

		// Count mentions/replies
		mentionEvents.forEach(event => {
			const pTags = event.tags.filter(tag => tag[0] === 'p');
			pTags.forEach(tag => {
				const contactPubkey = tag[1];
				if (contactPubkeys.includes(contactPubkey)) {
					const scoreData = scores.get(contactPubkey);
					if (scoreData) {
						scoreData.replies++;
					}
				}
			});
		});

		// For reactions and reposts, we need to check if they're interacting with contacts' posts
		// First, fetch contact posts to build a map of event IDs -> contact pubkeys
		const contactPosts = await p.querySync(queryRelays, {
			kinds: [1],
			authors: contactPubkeys,
			since
		});

		const eventIdToContactPubkey = new Map<string, string>();
		contactPosts.forEach(event => {
			if (event.id) {
				eventIdToContactPubkey.set(event.id, event.pubkey);
			}
		});

		// Count reactions to contacts' posts
		reactionEvents.forEach(event => {
			const eTags = event.tags.filter(tag => tag[0] === 'e');
			eTags.forEach(tag => {
				const eventId = tag[1];
				const contactPubkey = eventIdToContactPubkey.get(eventId);
				if (contactPubkey) {
					const scoreData = scores.get(contactPubkey);
					if (scoreData) {
						scoreData.reactions++;
					}
				}
			});
		});

		// Count reposts of contacts' posts
		repostEvents.forEach(event => {
			const eTags = event.tags.filter(tag => tag[0] === 'e');
			eTags.forEach(tag => {
				const eventId = tag[1];
				const contactPubkey = eventIdToContactPubkey.get(eventId);
				if (contactPubkey) {
					const scoreData = scores.get(contactPubkey);
					if (scoreData) {
						scoreData.reposts++;
					}
				}
			});
		});

		// Count zaps to contacts (check if target user is the sender)
		zapEvents.forEach(event => {
			// Check if target user is the sender by parsing the zap request in description
			const descriptionTag = event.tags.find(tag => tag[0] === 'description');
			if (descriptionTag && descriptionTag[1]) {
				try {
					const zapRequest = JSON.parse(descriptionTag[1]);
					if (zapRequest.pubkey === targetUserPubkey) {
						// This zap is from the target user
						const zapAmount = extractZapAmount(event);
						const pTags = event.tags.filter(tag => tag[0] === 'p');

						pTags.forEach(tag => {
							const contactPubkey = tag[1];
							if (contactPubkeys.includes(contactPubkey)) {
								const scoreData = scores.get(contactPubkey);
								if (scoreData) {
									scoreData.zaps += zapAmount;
								}
							}
						});
					}
				} catch (error) {
					// Failed to parse zap request
				}
			}
		});

		// Calculate final scores using the formula:
		// score = reactionsCount + repostsCount * 3 + zappedSats / 10 + repliesCount * 4
		scores.forEach(scoreData => {
			scoreData.score = Math.round(
				scoreData.reactions +
				scoreData.reposts * 3 +
				scoreData.zaps / 10 +
				scoreData.replies * 4
			);
		});

	} catch (error) {
		console.error('Error calculating interaction scores:', error);
	}

	return scores;
}

import { writable } from 'svelte/store';
import type { UserProfile } from './nostr';

interface ComparisonData {
	currentUser: UserProfile;
	currentUserContacts: string[];
	targetUser: UserProfile;
	targetUserContacts: string[];
}

export const comparisonStore = writable<ComparisonData | null>(null);

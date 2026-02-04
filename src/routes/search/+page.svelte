<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fetchUserProfile, fetchContactList, type UserProfile } from '$lib/nostr';
	import { comparisonStore } from '$lib/store';
	import { logout } from '$lib/auth';

	let compareNpub = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);
	let isFetchingProfile = $state(true);

	let currentUser = $state<UserProfile | null>(null);
	let currentUserContacts = $state<string[]>([]);

	onMount(async () => {
		const userPubkey = localStorage.getItem('userPubkey');
		if (!userPubkey) {
			goto('/');
			return;
		}

		try {
			const [profile, contacts] = await Promise.all([
				fetchUserProfile(userPubkey),
				fetchContactList(userPubkey)
			]);
			currentUser = profile;
			currentUserContacts = contacts;
		} catch (error) {
			console.error('Error fetching user profile:', error);
			errorMessage = 'Failed to load profile data';
		} finally {
			isFetchingProfile = false;
		}
	});

	function handleLogout() {
		logout();
		goto('/');
	}

	function handleLoadContact() {
		errorMessage = '';

		if (!compareNpub.trim()) {
			errorMessage = 'Please enter a npub or nprofile';
			return;
		}

		try {
			const decoded = nip19.decode(compareNpub.trim());
			if (decoded.type !== 'npub' && decoded.type !== 'nprofile') {
				errorMessage = 'Invalid npub or nprofile';
				return;
			}

			const targetPubkey = decoded.type === 'npub' ? decoded.data : decoded.data.pubkey;

			// Save target pubkey to localStorage
			localStorage.setItem('targetPubkey', targetPubkey);

			// Navigate to contacts page (will load data there)
			goto('/contacts');
		} catch (error) {
			console.error('Error decoding npub:', error);
			errorMessage = 'Invalid npub or nprofile format';
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	{#if isFetchingProfile}
		<div class="text-center">
			<p class="text-lg text-gray-600">Loading your profile...</p>
		</div>
	{:else if currentUser}
		<div class="w-full max-w-xl space-y-6">
			<!-- User Profile -->
			<div class="relative flex w-fit items-start gap-4">
				<img
					src={currentUser.picture ||
						'https://api.dicebear.com/7.x/identicon/svg?seed=' + currentUser.pubkey}
					alt={currentUser.name || 'User'}
					class="h-16 w-16 rounded-full"
				/>
				<div>
					<h1 class="text-2xl font-bold text-gray-900">{currentUser.name || 'Anonymous'}</h1>
					<p class="text-sm text-gray-500">
						{currentUser.npub.slice(0, 8)}...{currentUser.npub.slice(-5)}
					</p>
				</div>
				<button
					onclick={handleLogout}
					class="absolute -top-2 -right-4 cursor-pointer rounded-full p-1.5 text-gray-600 shadow-md transition-colors hover:bg-white hover:text-red-600"
					title="Logout and start fresh"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
				</button>
			</div>

			<!-- Welcome Message -->
			<p class="leading-6 text-gray-900">
				Welcome <span class="font-medium"
					>{currentUser.display_name || currentUser.name || 'Anonymous'}</span
				>, your most recent contacts list has been fetched.
				{#if currentUser.lastUpdated}
					It has been updated on <span class="font-medium">{currentUser.lastUpdated}</span>
				{/if}
				and it contains <span class="font-medium">{currentUser.contactsCount}</span>
				{currentUser.contactsCount === 1 ? 'person' : 'people'}. Now tell me which profile you want
				to compare it with:
			</p>

			<!-- Error Message -->
			{#if errorMessage}
				<div
					class="w-full rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800"
				>
					{errorMessage}
				</div>
			{/if}

			<div class="space-y-4">
				<!-- Input -->
				<input
					type="text"
					bind:value={compareNpub}
					placeholder="npub or nprofile"
					class="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none"
				/>

				<!-- Button -->
				<button
					onclick={handleLoadContact}
					disabled={isLoading}
					class="w-full cursor-pointer rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
				>
					{isLoading ? 'Loading...' : 'Load the target user data'}
				</button>
			</div>
		</div>
	{/if}
</div>

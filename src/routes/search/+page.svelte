<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { queryProfile } from 'nostr-tools/nip05';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fetchUserProfile, fetchContactList, type UserProfile } from '$lib/nostr';
	import { comparisonStore } from '$lib/store';
	import { logout } from '$lib/auth';

	let compareNpub = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);
	let isFetchingProfile = $state(true);
	let showSuggestions = $state(false);
	let isFetchingSuggestions = $state(false);

	let currentUser = $state<UserProfile | null>(null);
	let currentUserContacts = $state<string[]>([]);
	let suggestedProfiles = $state<UserProfile[]>([]);

	// Curated npubs of users with quality contact lists
	const curatedNpubs = [
		'npub10000003zmk89narqpczy4ff6rnuht2wu05na7kpnh3mak7z2tqzsv8vwqk',
		'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
		'npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn',
		'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc',
		'npub18ams6ewn5aj2n3wt2qawzglx9mr4nzksxhvrdc4gzrecw7n5tvjqctp424',
		'npub12rv5lskctqxxs2c8rf2zlzc7xx3qpvzs3w4etgemauy9thegr43sf485vg',
		'npub1t6jxfqz9hv0lygn9thwndekuahwyxkgvycyscjrtauuw73gd5k7sqvksrw',
		'npub1tcekjparmkju6k83r5tzmzjvjwy0nnajlrwyk35us9g7x7wx80ys9hjmky'
	];

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

	async function handleShowSuggestions() {
		showSuggestions = true;
		isFetchingSuggestions = true;
		errorMessage = '';

		try {
			const profiles = await Promise.all(
				curatedNpubs.map(async (npub) => {
					const decoded = nip19.decode(npub);
					const pubkey = decoded.type === 'npub' ? decoded.data : '';
					return fetchUserProfile(pubkey);
				})
			);
			suggestedProfiles = profiles;
		} catch (error) {
			console.error('Error fetching suggested profiles:', error);
			errorMessage = 'Failed to load suggested profiles';
		} finally {
			isFetchingSuggestions = false;
		}
	}

	function handleLogout() {
		logout();
		goto('/');
	}

	async function handleLoadContact() {
		errorMessage = '';
		isLoading = true;

		if (!compareNpub.trim()) {
			errorMessage = 'Please enter a npub, nprofile, or NIP-05 identifier';
			isLoading = false;
			return;
		}

		const input = compareNpub.trim();

		// Check if input looks like an email (name@domain.com)
		const looksLikeEmail = input.includes('@');

		// Check if input looks like a domain (domain.com)
		const looksLikeDomain =
			input.includes('.') && !input.startsWith('npub') && !input.startsWith('nprofile');

		try {
			let targetPubkey: string | undefined;

			if (looksLikeEmail || looksLikeDomain) {
				// NIP-05 lookup
				const profile = await queryProfile(input);
				if (profile && profile.pubkey) {
					targetPubkey = profile.pubkey;
				} else {
					errorMessage = 'NIP-05 identifier not found or invalid';
					isLoading = false;
					return;
				}
			} else if (input.startsWith('npub') || input.startsWith('nprofile')) {
				// npub/nprofile decoding
				const decoded = nip19.decode(input);
				if (decoded.type !== 'npub' && decoded.type !== 'nprofile') {
					errorMessage = 'Invalid npub or nprofile';
					isLoading = false;
					return;
				}
				targetPubkey = decoded.type === 'npub' ? decoded.data : decoded.data.pubkey;
			} else {
				errorMessage = 'Invalid format. Please enter a npub, nprofile, or NIP-05 identifier';
				isLoading = false;
				return;
			}

			localStorage.setItem('targetPubkey', targetPubkey);
			goto('/contacts');
		} catch (error) {
			console.error('Error resolving user:', error);
			errorMessage = 'Invalid format or lookup failed. Please try again.';
			isLoading = false;
		}
	}

	function handleSelectSuggestion(profile: UserProfile) {
		localStorage.setItem('targetPubkey', profile.pubkey);
		goto('/contacts');
	}

	function handleBackToInput() {
		showSuggestions = false;
		errorMessage = '';
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	{#if isFetchingProfile}
		<div class="text-center">
			<p class="text-lg text-gray-600">Loading your profile...</p>
		</div>
	{:else if currentUser}
		<div class="w-full max-w-xl space-y-6">
			{#if !showSuggestions}
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

				<p class="leading-6 text-gray-900">
					Welcome <span class="font-medium"
						>{currentUser.display_name || currentUser.name || 'Anonymous'}</span
					>, your most recent contact list has been fetched.
					{#if currentUser.lastUpdated}
						It has been updated on <span class="font-medium">{currentUser.lastUpdated}</span>
					{/if}
					and it contains <span class="font-medium">{currentUser.contactsCount}</span>
					{currentUser.contactsCount === 1 ? 'person' : 'people'}. Now tell me which profile you
					want to compare it with:
				</p>

				{#if errorMessage}
					<div
						class="w-full rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800"
					>
						{errorMessage}
					</div>
				{/if}
				<div class="space-y-4">
					<input
						type="text"
						bind:value={compareNpub}
						placeholder="npub, nprofile, or NIP-05 (e.g., dtonon.com)"
						onkeydown={(e) => e.key === 'Enter' && handleLoadContact()}
						class="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none"
					/>

					<button
						onclick={handleLoadContact}
						disabled={isLoading}
						class="w-full cursor-pointer rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
					>
						{isLoading ? 'Loading...' : 'Load the target user data'}
					</button>

					<div class="text-center">
						<button
							onclick={handleShowSuggestions}
							class="cursor-pointer text-gray-600 underline transition-colors hover:text-gray-900"
						>
							Would you like some suggestions of users with curated contact list?
						</button>
					</div>
				</div>
			{:else}
				<div class="my-10 space-y-6">
					<p class="leading-6 text-gray-900">
						Compare your contact list with that of one of the following people:
					</p>

					{#if isFetchingSuggestions}
						<div class="py-8 text-center">
							<p class="text-gray-600">Loading suggestions...</p>
						</div>
					{:else}
						<div class="overflow-hidden">
							{#each suggestedProfiles as profile}
								<div
									role="button"
									tabindex="0"
									onclick={() => handleSelectSuggestion(profile)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleSelectSuggestion(profile);
										}
									}}
									class="relative flex cursor-pointer gap-4 border-b-3 border-gray-200 p-4 transition-all hover:bg-gray-100"
								>
									<img
										src={profile.picture ||
											'https://api.dicebear.com/7.x/identicon/svg?seed=' + profile.pubkey}
										alt={profile.name || 'Anonymous'}
										class="h-14 w-14 flex-shrink-0 rounded-full"
									/>
									<div class="flex-1">
										<h3 class="text-xl font-medium text-gray-900">
											{profile.name || 'Anonymous'}
										</h3>
										<p class="text-sm text-gray-500">
											{profile.npub.slice(0, 8)}...{profile.npub.slice(-5)}
										</p>
										{#if profile.about}
											<p class="mt-1 line-clamp-2 leading-5 text-gray-700">{profile.about}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<div class="text-center">
							<button
								onclick={handleBackToInput}
								class="cursor-pointer text-gray-600 underline transition-colors hover:text-gray-900"
							>
								Go back to the free input
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

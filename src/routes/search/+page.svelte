<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';

	let compareNpub = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);

	// Mock user data
	let currentUser = {
		name: 'daniele',
		npub: 'npub1xxxx...zzzz',
		picture: 'https://i.pravatar.cc/150?img=5',
		contactsCount: 150,
		lastUpdated: 'June 15, 2024 at 3:45 PM'
	};

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

			isLoading = true;
			// Simulate loading
			setTimeout(() => {
				isLoading = false;
				goto('/contacts');
			}, 500);
		} catch (error) {
			errorMessage = 'Invalid npub or nprofile format';
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-xl space-y-8">
		<!-- User Profile -->
		<div class="flex items-center gap-4">
			<img src={currentUser.picture} alt={currentUser.name} class="h-16 w-16 rounded-full" />
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{currentUser.name}</h1>
				<p class="text-sm text-gray-500">{currentUser.npub}</p>
			</div>
		</div>

		<!-- Welcome Message -->
		<p class="leading-6 text-gray-900">
			Welcome <span class="font-medium">{currentUser.name}</span>, your most recent contacts list
			has been fetched. It has been updated on
			<span class="font-medium">{currentUser.lastUpdated}</span>
			and it contains <span class="font-medium">{currentUser.contactsCount}</span>
			people. Now tell me which profile you want to compare it with:
		</p>

		<!-- Error Message -->
		{#if errorMessage}
			<div
				class="w-full rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800"
			>
				{errorMessage}
			</div>
		{/if}

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
			{isLoading ? 'Loading...' : 'Load the contact data'}
		</button>
	</div>
</div>

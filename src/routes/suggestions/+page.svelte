<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fetchUserProfile, type UserProfile } from '$lib/nostr';
	import { logout } from '$lib/auth';

	let isFetchingSuggestions = $state(true);
	let errorMessage = $state('');
	let suggestedProfiles = $state<UserProfile[]>([]);

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
	});

	function handleSelectSuggestion(profile: UserProfile) {
		localStorage.setItem('targetPubkey', profile.pubkey);
		goto('/contacts');
	}

	function handleLogout() {
		logout();
		goto('/');
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-xl space-y-6">
		<div class="my-10 space-y-6">
			<p class="font-medium leading-6 text-gray-900">
				Compare your contact list with that of one of the following people:
			</p>

			{#if errorMessage}
				<div
					class="w-full rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800"
				>
					{errorMessage}
				</div>
			{/if}

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
						onclick={() => goto('/search')}
						class="cursor-pointer text-gray-600 underline transition-colors hover:text-gray-900"
					>
						Go back to the free input
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

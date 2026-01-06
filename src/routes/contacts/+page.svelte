<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fetchMultipleProfiles, type UserProfile, type ContactProfile } from '$lib/nostr';
	import { comparisonStore } from '$lib/store';

	let activeTab = $state<'new' | 'common' | 'missing'>('new');
	let selectedNewContacts = $state<Set<string>>(new Set());
	let selectedCommonContacts = $state<Set<string>>(new Set());
	let selectedMissingContacts = $state<Set<string>>(new Set());
	let isLoading = $state(true);
	let loginMode = $state<'full' | 'read'>('read');

	let currentUser = $state<UserProfile | null>(null);
	let targetUser = $state<UserProfile | null>(null);

	interface ContactWithProfile extends ContactProfile {
		id: string;
	}

	let allContacts = $state<{
		new: ContactWithProfile[];
		common: ContactWithProfile[];
		missing: ContactWithProfile[];
	}>({
		new: [],
		common: [],
		missing: []
	});

	function toggleContactSelection(contactId: string) {
		// Disable selection in read-only mode
		if (loginMode === 'read') return;

		let selectedSet: Set<string>;

		if (activeTab === 'new') {
			selectedSet = new Set(selectedNewContacts);
		} else if (activeTab === 'common') {
			selectedSet = new Set(selectedCommonContacts);
		} else {
			selectedSet = new Set(selectedMissingContacts);
		}

		if (selectedSet.has(contactId)) {
			selectedSet.delete(contactId);
		} else {
			selectedSet.add(contactId);
		}

		if (activeTab === 'new') {
			selectedNewContacts = selectedSet;
		} else if (activeTab === 'common') {
			selectedCommonContacts = selectedSet;
		} else {
			selectedMissingContacts = selectedSet;
		}
	}

	function handleReadOnlyLogout() {
		localStorage.removeItem('userPubkey');
		localStorage.removeItem('loginMode');
		comparisonStore.set(null);
		goto('/');
	}

	function getActiveSelection(): Set<string> {
		if (activeTab === 'new') return selectedNewContacts;
		if (activeTab === 'common') return selectedCommonContacts;
		return selectedMissingContacts;
	}

	function getActionText(): string {
		const selection = getActiveSelection();
		const count = selection.size;
		const people = count === 1 ? 'person' : 'people';

		if (activeTab === 'new') {
			return `Add ${count} ${people} to my contacts`;
		} else {
			return `Remove ${count} ${people} from my contacts`;
		}
	}

	onMount(async () => {
		// Get login mode
		loginMode = (localStorage.getItem('loginMode') as 'full' | 'read') || 'read';

		// Get data from store
		const data = $comparisonStore;

		if (!data) {
			goto('/search');
			return;
		}

		currentUser = data.currentUser;
		targetUser = data.targetUser;

		const currentContacts = new Set(data.currentUserContacts);
		const targetContacts = new Set(data.targetUserContacts);

		// Compute diffs
		const newContactsPubkeys: string[] = [];
		const commonContactsPubkeys: string[] = [];
		const missingContactsPubkeys: string[] = [];

		// New = in target but not in current
		targetContacts.forEach((pubkey) => {
			if (!currentContacts.has(pubkey)) {
				newContactsPubkeys.push(pubkey);
			} else {
				commonContactsPubkeys.push(pubkey);
			}
		});

		// Missing = in current but not in target
		currentContacts.forEach((pubkey) => {
			if (!targetContacts.has(pubkey)) {
				missingContactsPubkeys.push(pubkey);
			}
		});

		// Fetch all profiles
		const allPubkeys = [...newContactsPubkeys, ...commonContactsPubkeys, ...missingContactsPubkeys];

		const profilesMap = await fetchMultipleProfiles(allPubkeys);

		// Map to contacts with profiles
		allContacts = {
			new: newContactsPubkeys.map((pubkey) => ({
				id: pubkey,
				...profilesMap.get(pubkey)!
			})),
			common: commonContactsPubkeys.map((pubkey) => ({
				id: pubkey,
				...profilesMap.get(pubkey)!
			})),
			missing: missingContactsPubkeys.map((pubkey) => ({
				id: pubkey,
				...profilesMap.get(pubkey)!
			}))
		};

		isLoading = false;
	});
</script>

<div class="min-h-screen bg-gray-50 px-4 py-20">
	{#if isLoading}
		<div class="flex min-h-screen items-center justify-center">
			<p class="text-lg text-gray-600">Loading contacts...</p>
		</div>
	{:else if currentUser && targetUser}
		<div class="mx-auto max-w-2xl space-y-8">
			<!-- Profile Comparison Header -->
			<div class="flex items-center justify-center gap-6">
				<div class="flex items-center gap-3">
					<img
						src={currentUser.picture ||
							'https://api.dicebear.com/7.x/identicon/svg?seed=' + currentUser.pubkey}
						alt={currentUser.name || 'User'}
						class="h-16 w-16 rounded-full"
					/>
					<div>
						<h2 class="text-xl font-medium text-gray-900">
							{currentUser.name || 'Anonymous'}
						</h2>
						<p class="text-sm text-gray-500">
							{currentUser.npub.slice(0, 8)}...{currentUser.npub.slice(-5)}
						</p>
					</div>
				</div>

				<svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>

				<div class="flex items-center gap-3">
					<img
						src={targetUser.picture ||
							'https://api.dicebear.com/7.x/identicon/svg?seed=' + targetUser.pubkey}
						alt={targetUser.name || 'User'}
						class="h-16 w-16 rounded-full"
					/>
					<div>
						<h2 class="text-xl font-medium text-gray-900">{targetUser.name || 'Anonymous'}</h2>
						<p class="text-sm text-gray-500">
							{targetUser.npub.slice(0, 8)}...{targetUser.npub.slice(-5)}
						</p>
					</div>
				</div>
			</div>

			<!-- Reports -->
			<div class="space-y-3">
				<p class="leading-6 text-gray-900">
					<span class="font-medium">{targetUser.name || 'Anonymous'}</span> has
					<span class="font-medium">{targetUser.contactsCount}</span>
					{targetUser.contactsCount === 1 ? 'person' : 'people'}
					in their contact list,
					<span class="font-medium">{allContacts.common.length}</span>
					{allContacts.common.length === 1 ? 'is' : 'are'} in common with you while there are
					<span class="font-medium">{allContacts.new.length}</span>
					{allContacts.new.length === 1 ? 'contact' : 'contacts'} that you don't follow yet; select some
					contacts to update your contact list:
				</p>
			</div>

			<!-- Tabs -->
			<div class="flex gap-2">
				<button
					onclick={() => (activeTab = 'new')}
					class="flex-1 rounded-l-lg px-4 py-3 font-semibold transition-colors {activeTab === 'new'
						? 'bg-pink-600 text-white'
						: 'bg-gray-600 text-white hover:bg-gray-700'}"
				>
					New ({allContacts.new.length})
				</button>
				<button
					onclick={() => (activeTab = 'common')}
					class="flex-1 px-4 py-3 font-semibold transition-colors {activeTab === 'common'
						? 'bg-pink-600 text-white'
						: 'bg-gray-600 text-white hover:bg-gray-700'}"
				>
					In common ({allContacts.common.length})
				</button>
				<button
					onclick={() => (activeTab = 'missing')}
					class="flex-1 rounded-r-lg px-4 py-3 font-semibold transition-colors {activeTab ===
					'missing'
						? 'bg-pink-600 text-white'
						: 'bg-gray-600 text-white hover:bg-gray-700'}"
				>
					Missing ({allContacts.missing.length})
				</button>
			</div>

			<!-- Contact List -->
			<div class={getActiveSelection().size > 0 ? 'mb-24' : ''}>
				<!-- New Tab -->
				<div class={activeTab === 'new' ? '' : 'hidden'}>
					{#each allContacts.new as contact (contact.id)}
						<div
							onclick={() => toggleContactSelection(contact.id)}
							class="flex gap-4 border-b-3 border-gray-200 p-4 transition-all {loginMode === 'full'
								? 'cursor-pointer'
								: 'cursor-default'} {selectedNewContacts.has(contact.id)
								? 'border-l-4 border-l-pink-600 bg-gray-100'
								: loginMode === 'full'
									? 'border-l-4 border-l-transparent hover:bg-gray-100'
									: 'border-l-4 border-l-transparent'}"
						>
							<img
								src={contact.picture ||
									'https://api.dicebear.com/7.x/identicon/svg?seed=' + contact.pubkey}
								alt={contact.name || 'Anonymous'}
								class="h-14 w-14 flex-shrink-0 rounded-full"
							/>
							<div class="flex-1">
								<h3 class="text-xl font-medium text-gray-900">{contact.name || 'Anonymous'}</h3>
								<p class="text-sm text-gray-500">
									{contact.npub.slice(0, 8)}...{contact.npub.slice(-5)}
								</p>
								{#if contact.about}
									<p class="mt-1 line-clamp-2 leading-5 text-gray-700">{contact.about}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Common Tab -->
				<div class={activeTab === 'common' ? '' : 'hidden'}>
					{#each allContacts.common as contact (contact.id)}
						<div
							onclick={() => toggleContactSelection(contact.id)}
							class="flex gap-4 border-b-3 border-gray-200 p-4 transition-all {loginMode === 'full'
								? 'cursor-pointer'
								: 'cursor-default'} {selectedCommonContacts.has(contact.id)
								? 'border-l-4 border-l-pink-600 bg-gray-100'
								: loginMode === 'full'
									? 'border-l-4 border-l-transparent hover:bg-gray-100'
									: 'border-l-4 border-l-transparent'}"
						>
							<img
								src={contact.picture ||
									'https://api.dicebear.com/7.x/identicon/svg?seed=' + contact.pubkey}
								alt={contact.name || 'Anonymous'}
								class="h-14 w-14 flex-shrink-0 rounded-full"
							/>
							<div class="flex-1">
								<h3 class="text-xl font-medium text-gray-900">{contact.name || 'Anonymous'}</h3>
								<p class="text-sm text-gray-500">
									{contact.npub.slice(0, 8)}...{contact.npub.slice(-5)}
								</p>
								{#if contact.about}
									<p class="mt-1 line-clamp-2 leading-5 text-gray-700">{contact.about}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Missing Tab -->
				<div class={activeTab === 'missing' ? '' : 'hidden'}>
					{#each allContacts.missing as contact (contact.id)}
						<div
							onclick={() => toggleContactSelection(contact.id)}
							class="flex gap-4 border-b-3 border-gray-200 p-4 transition-all {loginMode === 'full'
								? 'cursor-pointer'
								: 'cursor-default'} {selectedMissingContacts.has(contact.id)
								? 'border-l-4 border-l-pink-600 bg-gray-100'
								: loginMode === 'full'
									? 'border-l-4 border-l-transparent hover:bg-gray-100'
									: 'border-l-4 border-l-transparent'}"
						>
							<img
								src={contact.picture ||
									'https://api.dicebear.com/7.x/identicon/svg?seed=' + contact.pubkey}
								alt={contact.name || 'Anonymous'}
								class="h-14 w-14 flex-shrink-0 rounded-full"
							/>
							<div class="flex-1">
								<h3 class="text-xl font-medium text-gray-900">{contact.name || 'Anonymous'}</h3>
								<p class="text-sm text-gray-500">
									{contact.npub.slice(0, 8)}...{contact.npub.slice(-5)}
								</p>
								{#if contact.about}
									<p class="mt-1 line-clamp-2 leading-5 text-gray-700">{contact.about}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Action Button - Fixed at Bottom -->
{#if loginMode === 'read'}
	<div class="fixed right-0 bottom-0 left-0 flex justify-center">
		<button
			onclick={handleReadOnlyLogout}
			class="w-full max-w-2xl cursor-pointer rounded-t-lg bg-gray-700 px-6 py-4 font-semibold text-white transition-colors hover:bg-gray-800"
		>
			Read-only mode, login to update the list
		</button>
	</div>
{:else if getActiveSelection().size > 0}
	<div class="fixed right-0 bottom-0 left-0 flex justify-center">
		<button
			class="w-full max-w-2xl cursor-pointer rounded-t-lg bg-pink-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-700"
		>
			{getActionText()}
		</button>
	</div>
{/if}

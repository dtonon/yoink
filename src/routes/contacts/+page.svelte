<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import {
		fetchMultipleProfiles,
		fetchUserProfile,
		fetchContactList,
		updateContactList,
		calculateInteractionScores,
		type UserProfile,
		type ContactProfile,
		type InteractionScore
	} from '$lib/nostr';
	import { comparisonStore } from '$lib/store';
	import { logout } from '$lib/auth';

	let activeTab = $state<'new' | 'common' | 'missing'>('new');
	let selectedNewContacts = $state<Set<string>>(new Set());
	let selectedCommonContacts = $state<Set<string>>(new Set());
	let selectedMissingContacts = $state<Set<string>>(new Set());
	let isLoading = $state(true);
	let loginMode = $state<'full' | 'read'>('read');
	let updateStatus = $state<'idle' | 'updating' | 'success'>('idle');
	let sortMode = $state<'default' | 'interactions'>('default');
	let isCalculatingScores = $state(false);

	let currentUser = $state<UserProfile | null>(null);
	let targetUser = $state<UserProfile | null>(null);
	let currentUserContactsList = $state<string[]>([]);

	interface ContactWithProfile extends ContactProfile {
		id: string;
		interactionScore?: number;
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
		logout();
		goto('/');
	}

	function handleReplaceTarget() {
		localStorage.removeItem('targetPubkey');
		comparisonStore.set(null);
		goto('/search');
	}

	function handleLogout() {
		logout();
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

	function handleSelectAll() {
		if (loginMode === 'read') return;

		const contacts = allContacts[activeTab];
		const currentSelection = getActiveSelection();
		const allSelected = contacts.length > 0 && contacts.every((c) => currentSelection.has(c.id));

		if (allSelected) {
			// Deselect all
			if (activeTab === 'new') {
				selectedNewContacts = new Set();
			} else if (activeTab === 'common') {
				selectedCommonContacts = new Set();
			} else {
				selectedMissingContacts = new Set();
			}
		} else {
			// Select all
			const allIds = new Set(contacts.map((c) => c.id));
			if (activeTab === 'new') {
				selectedNewContacts = allIds;
			} else if (activeTab === 'common') {
				selectedCommonContacts = allIds;
			} else {
				selectedMissingContacts = allIds;
			}
		}
	}

	function isAllSelected(): boolean {
		const contacts = allContacts[activeTab];
		const currentSelection = getActiveSelection();
		return contacts.length > 0 && contacts.every((c) => currentSelection.has(c.id));
	}

	async function handleSortByInteractions() {
		if (sortMode === 'interactions') {
			// Switch back to default sort
			sortMode = 'default';
			return;
		}

		if (!targetUser) {
			return;
		}

		// Check if scores are already calculated in memory
		const scoresExist =
			allContacts.new.some((c) => c.interactionScore !== undefined) ||
			allContacts.common.some((c) => c.interactionScore !== undefined) ||
			allContacts.missing.some((c) => c.interactionScore !== undefined);

		if (scoresExist) {
			// Scores already exist, just switch to interactions mode
			sortMode = 'interactions';
			return;
		}

		// Calculate scores
		isCalculatingScores = true;

		try {
			const allPubkeys = [
				...allContacts.new.map((c) => c.id),
				...allContacts.common.map((c) => c.id),
				...allContacts.missing.map((c) => c.id)
			];

			const scores = await calculateInteractionScores(targetUser.pubkey, allPubkeys, 30);

			// Store scores directly in contact objects
			allContacts.new.forEach((contact) => {
				contact.interactionScore = scores.get(contact.id)?.score || 0;
			});
			allContacts.common.forEach((contact) => {
				contact.interactionScore = scores.get(contact.id)?.score || 0;
			});
			allContacts.missing.forEach((contact) => {
				contact.interactionScore = scores.get(contact.id)?.score || 0;
			});

			sortMode = 'interactions';
		} catch (error) {
			console.error('Error calculating interaction scores:', error);
			alert('Failed to calculate interaction scores. Please try again.');
		} finally {
			isCalculatingScores = false;
		}
	}

	function getSortedContacts(contacts: ContactWithProfile[]): ContactWithProfile[] {
		if (sortMode === 'default') {
			// Sort alphabetically by name, with anonymous contacts at the bottom
			return [...contacts].sort((a, b) => {
				const nameA = a.name || '';
				const nameB = b.name || '';

				// If both have no name, maintain order
				if (!nameA && !nameB) return 0;

				// If only A has no name, put it after B
				if (!nameA) return 1;

				// If only B has no name, put it after A
				if (!nameB) return -1;

				// Both have names, sort alphabetically (case-insensitive)
				return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
			});
		}

		// Sort by interaction score (highest first)
		return [...contacts].sort((a, b) => {
			const scoreA = a.interactionScore || 0;
			const scoreB = b.interactionScore || 0;
			return scoreB - scoreA;
		});
	}

	function getInteractionScore(contact: ContactWithProfile): number {
		return contact.interactionScore || 0;
	}

	async function handleUpdate() {
		if (updateStatus === 'updating' || !currentUser) return;

		updateStatus = 'updating';

		try {
			let newContactsList = [...currentUserContactsList];

			if (activeTab === 'new') {
				// Add selected contacts
				const toAdd = Array.from(selectedNewContacts);
				newContactsList = [...new Set([...newContactsList, ...toAdd])];
			} else {
				// Remove selected contacts (common or missing tabs)
				const toRemove =
					activeTab === 'common'
						? Array.from(selectedCommonContacts)
						: Array.from(selectedMissingContacts);
				newContactsList = newContactsList.filter((pubkey) => !toRemove.includes(pubkey));
			}

			// Update contact list on Nostr
			await updateContactList(currentUser.pubkey, newContactsList);

			// Update local state
			currentUserContactsList = newContactsList;

			// Clear selections
			if (activeTab === 'new') {
				selectedNewContacts = new Set();
			} else if (activeTab === 'common') {
				selectedCommonContacts = new Set();
			} else {
				selectedMissingContacts = new Set();
			}

			// Recompute contacts comparison
			await recomputeContacts();

			// Show success state
			updateStatus = 'success';

			// Fade out after 3 seconds
			setTimeout(() => {
				updateStatus = 'idle';
			}, 3000);
		} catch (error) {
			console.error('Error updating contact list:', error);
			updateStatus = 'idle';
			alert('Failed to update contact list. Please try again.');
		}
	}

	async function recomputeContacts() {
		if (!currentUser || !targetUser) return;

		const currentContacts = new Set(currentUserContactsList);
		const data = $comparisonStore;
		if (!data) return;

		const targetContacts = new Set(data.targetUserContacts);

		// Compute diffs
		const newContactsPubkeys: string[] = [];
		const commonContactsPubkeys: string[] = [];
		const missingContactsPubkeys: string[] = [];

		targetContacts.forEach((pubkey) => {
			if (!currentContacts.has(pubkey)) {
				newContactsPubkeys.push(pubkey);
			} else {
				commonContactsPubkeys.push(pubkey);
			}
		});

		currentContacts.forEach((pubkey) => {
			if (!targetContacts.has(pubkey)) {
				missingContactsPubkeys.push(pubkey);
			}
		});

		// Update user profile count
		currentUser.contactsCount = currentUserContactsList.length;

		// Fetch profiles for new contacts if needed
		const allPubkeys = [...newContactsPubkeys, ...commonContactsPubkeys, ...missingContactsPubkeys];
		const profilesMap = await fetchMultipleProfiles(allPubkeys);

		// Update contacts
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
	}

	onMount(async () => {
		// Get login mode
		loginMode = (localStorage.getItem('loginMode') as 'full' | 'read') || 'read';

		// Get pubkeys from localStorage
		const targetPubkey = localStorage.getItem('targetPubkey');
		const userPubkey = localStorage.getItem('userPubkey');

		if (!targetPubkey || !userPubkey) {
			goto('/search');
			return;
		}

		try {
			// Always fetch both users fresh
			const [currentUserProfile, currentUserContacts, targetUserProfile, targetUserContacts] =
				await Promise.all([
					fetchUserProfile(userPubkey),
					fetchContactList(userPubkey),
					fetchUserProfile(targetPubkey),
					fetchContactList(targetPubkey)
				]);

			// Store comparison data
			const data = {
				currentUser: currentUserProfile,
				currentUserContacts: currentUserContacts,
				targetUser: targetUserProfile,
				targetUserContacts: targetUserContacts
			};
			comparisonStore.set(data);

			currentUser = currentUserProfile;
			targetUser = targetUserProfile;
			currentUserContactsList = [...currentUserContacts];

			const currentContactsSet = new Set(currentUserContacts);
			const targetContactsSet = new Set(targetUserContacts);

			// Compute diffs
			const newContactsPubkeys: string[] = [];
			const commonContactsPubkeys: string[] = [];
			const missingContactsPubkeys: string[] = [];

			// New = in target but not in current
			targetContactsSet.forEach((pubkey) => {
				if (!currentContactsSet.has(pubkey)) {
					newContactsPubkeys.push(pubkey);
				} else {
					commonContactsPubkeys.push(pubkey);
				}
			});

			// Missing = in current but not in target
			currentContactsSet.forEach((pubkey) => {
				if (!targetContactsSet.has(pubkey)) {
					missingContactsPubkeys.push(pubkey);
				}
			});

			// Fetch all profiles
			const allPubkeys = [
				...newContactsPubkeys,
				...commonContactsPubkeys,
				...missingContactsPubkeys
			];

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
		} catch (error) {
			console.error('Error loading comparison:', error);
			isLoading = false;
			goto('/search');
		}
	});
</script>

{#if isLoading}
	<div class="fixed inset-0 bg-gray-50 px-8 py-8 sm:px-4 sm:py-20">
		<div class="flex h-full items-center justify-center">
			<p class="text-lg text-gray-600">Loading contacts...</p>
		</div>
	</div>
{:else if currentUser && targetUser}
	<div class="min-h-screen bg-gray-50 px-8 py-8 sm:px-4 sm:py-20">
		<div class="mx-auto max-w-2xl space-y-8">
			<!-- Profile Comparison Header -->
			<div class="flex flex-col items-center justify-center gap-0 sm:flex-row sm:gap-4 sm:gap-10">
				<div class="relative flex w-full items-center gap-3 sm:w-auto">
					<img
						src={currentUser.picture ||
							'https://api.dicebear.com/7.x/identicon/svg?seed=' + currentUser.pubkey}
						alt={currentUser.name || 'User'}
						class="h-16 w-16 rounded-full"
					/>
					<div class="flex-1 sm:flex-initial">
						<h2 class="text-xl font-medium text-gray-900">
							{currentUser.name || 'Anonymous'}
						</h2>
						<p class="text-sm text-gray-500">
							{currentUser.npub.slice(0, 8)}...{currentUser.npub.slice(-5)}
						</p>
					</div>
					<button
						onclick={handleLogout}
						class="cursor-pointer rounded-full p-1.5 text-gray-600 shadow-md transition-colors hover:bg-white hover:text-red-600"
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

				<svg
					class="h-8 w-8 rotate-90 text-gray-400 sm:rotate-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>

				<div class="relative flex w-full items-center gap-3 sm:w-auto">
					<img
						src={targetUser.picture ||
							'https://api.dicebear.com/7.x/identicon/svg?seed=' + targetUser.pubkey}
						alt={targetUser.name || 'User'}
						class="h-16 w-16 rounded-full"
					/>
					<div class="flex-1 sm:flex-initial">
						<h2 class="text-xl font-medium text-gray-900">{targetUser.name || 'Anonymous'}</h2>
						<p class="text-sm text-gray-500">
							{targetUser.npub.slice(0, 8)}...{targetUser.npub.slice(-5)}
						</p>
					</div>
					<button
						onclick={handleReplaceTarget}
						class="cursor-pointer rounded-full p-1.5 text-gray-600 shadow-md transition-colors hover:bg-white hover:text-accent"
						title="Replace target profile"
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
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
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

			<div class="space-y-4">
				<!-- Tabs -->
				<div class="flex gap-1">
					<button
						onclick={() => (activeTab = 'new')}
						class="flex flex-1 cursor-pointer flex-col items-center rounded-l-lg px-4 py-3 font-semibold transition-colors sm:flex-row sm:justify-between {activeTab ===
						'new'
							? 'bg-pink-600 text-white'
							: 'bg-gray-600 text-white hover:bg-gray-700'}"
					>
						<span>New</span>
						<div class="text-sm">
							{allContacts.new.length}
						</div>
					</button>
					<button
						onclick={() => (activeTab = 'common')}
						class="flex flex-1 cursor-pointer flex-col items-center px-4 py-3 font-semibold transition-colors sm:flex-row sm:justify-between {activeTab ===
						'common'
							? 'bg-pink-600 text-white'
							: 'bg-gray-600 text-white hover:bg-gray-700'}"
					>
						<span>Common</span>
						<div class="text-sm">
							{allContacts.common.length}
						</div>
					</button>
					<button
						onclick={() => (activeTab = 'missing')}
						class="flex flex-1 cursor-pointer flex-col items-center rounded-r-lg px-4 py-3 font-semibold transition-colors sm:flex-row sm:justify-between {activeTab ===
						'missing'
							? 'bg-pink-600 text-white'
							: 'bg-gray-600 text-white hover:bg-gray-700'}"
					>
						<span>Missing</span>
						<div class="text-sm">
							{allContacts.missing.length}
						</div>
					</button>
				</div>

				<!-- Select All and Sort Buttons -->
				{#if allContacts[activeTab].length > 0}
					<div class="flex justify-between rounded-lg bg-gray-100 px-4 py-2">
						<button
							onclick={handleSortByInteractions}
							disabled={isCalculatingScores}
							class="cursor-pointer text-sm font-medium text-gray-700 transition-colors hover:text-accent-hover disabled:cursor-wait disabled:opacity-50"
						>
							{#if isCalculatingScores}
								<span class="flex items-center gap-1">
									<svg
										class="h-4 w-4 animate-spin"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									Calculating...
								</span>
							{:else if sortMode === 'interactions'}
								Sort by name
							{:else}
								<div class="flex items-center gap-1">
									Sort by {targetUser?.name || 'Anonymous'}'s interactions
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="lucide lucide-sparkles text-primary"
										><path
											d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
										></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"
										></path><path d="M5 18H3"></path></svg
									>
								</div>
							{/if}
						</button>
						{#if loginMode === 'full'}
							<button
								onclick={handleSelectAll}
								class="cursor-pointer text-sm font-medium text-gray-700 transition-colors hover:text-accent-hover"
							>
								{isAllSelected() ? 'Deselect all' : 'Select all'}
							</button>
						{/if}
					</div>
				{/if}

				<!-- Contact List -->
				<div class="overflow-hidden {getActiveSelection().size > 0 ? 'mb-24' : ''}">
					{#snippet contactRow(contact: ContactWithProfile, isSelected: boolean)}
						<div
							role="button"
							tabindex={loginMode === 'full' ? 0 : -1}
							onclick={() => toggleContactSelection(contact.id)}
							onkeydown={(e) => {
								if (loginMode === 'full' && (e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									toggleContactSelection(contact.id);
								}
							}}
							class="relative flex gap-4 border-b-3 border-gray-200 px-2 py-4 transition-all sm:px-4 {loginMode ===
							'full'
								? 'cursor-pointer'
								: 'cursor-default'} {isSelected
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
								<div class="flex items-center gap-2">
									<h3 class="text-xl font-medium text-gray-900">{contact.name || 'Anonymous'}</h3>
									{#if sortMode === 'interactions' && getInteractionScore(contact) > 0}
										<span
											class="flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-xs font-medium text-pink-700"
											title="Interaction score"
										>
											{getInteractionScore(contact)}
										</span>
									{/if}
								</div>
								<p class="text-sm text-gray-500">
									{contact.npub.slice(0, 8)}...{contact.npub.slice(-5)}
								</p>
								{#if contact.about}
									<p class="mt-1 line-clamp-2 leading-5 text-gray-700">{contact.about}</p>
								{/if}
							</div>
							<a
								href="https://fevela.me/{contact.npub}"
								target="_blank"
								rel="noopener noreferrer"
								onclick={(e) => e.stopPropagation()}
								class="absolute top-4 right-4 text-gray-500 transition-colors hover:text-accent-hover"
								title="View profile"
								aria-label="View {contact.name || 'Anonymous'}'s profile"
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
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							</a>
						</div>
					{/snippet}

					<!-- New Tab -->
					<div class={activeTab === 'new' ? 'block' : 'hidden'}>
						{#each getSortedContacts(allContacts.new) as contact (contact.id)}
							{@render contactRow(contact, selectedNewContacts.has(contact.id))}
						{/each}
					</div>

					<!-- Common Tab -->
					<div class={activeTab === 'common' ? 'block' : 'hidden'}>
						{#each getSortedContacts(allContacts.common) as contact (contact.id)}
							{@render contactRow(contact, selectedCommonContacts.has(contact.id))}
						{/each}
					</div>

					<!-- Missing Tab -->
					<div class={activeTab === 'missing' ? 'block' : 'hidden'}>
						{#each getSortedContacts(allContacts.missing) as contact (contact.id)}
							{@render contactRow(contact, selectedMissingContacts.has(contact.id))}
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Action Button - Fixed at Bottom -->
{#if loginMode === 'read'}
	<div class="fixed right-0 bottom-0 left-0 flex justify-center px-8">
		<button
			onclick={handleReadOnlyLogout}
			class="w-full max-w-2xl cursor-pointer rounded-t-lg bg-gray-700 px-6 py-4 font-semibold text-white transition-colors hover:bg-gray-800"
		>
			Read-only mode, login to update the list
		</button>
	</div>
{:else if updateStatus === 'success'}
	<div class="fixed right-0 bottom-0 left-0 flex justify-center px-4" transition:fade>
		<button class="w-full max-w-2xl rounded-t-lg bg-green-600 px-6 py-4 font-semibold text-white">
			Update done
		</button>
	</div>
{:else if getActiveSelection().size > 0}
	<div class="fixed right-0 bottom-0 left-0 flex justify-center px-8">
		<button
			onclick={handleUpdate}
			disabled={updateStatus === 'updating'}
			class="w-full max-w-2xl cursor-pointer rounded-t-lg bg-pink-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-75"
		>
			{#if updateStatus === 'updating'}
				<span class="flex items-center justify-center gap-2">
					<svg
						class="h-5 w-5 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Updating...
				</span>
			{:else}
				{getActionText()}
			{/if}
		</button>
	</div>
{/if}

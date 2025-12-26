<script lang="ts">
	let activeTab = $state<'new' | 'common' | 'missing'>('new');

	// Mock user data
	let currentUser = {
		name: 'daniele',
		npub: 'npub1xxxx...zzzz',
		picture: 'https://i.pravatar.cc/150?img=5',
		contactsCount: 150,
		lastUpdated: 'June 15, 2024 at 3:45 PM'
	};

	// Mock compared profile data
	let comparedProfile = {
		name: 'banana republic',
		npub: 'npub1xxxx...zzzz',
		picture: 'https://i.pravatar.cc/150?img=12',
		contactsCount: 89,
		commonContacts: 42,
		newContacts: 35
	};

	// Mock contacts data
	const allContacts = {
		new: [
			{
				id: '1',
				name: 'little boy',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=33',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			},
			{
				id: '2',
				name: 'Diamond',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=22',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			},
			{
				id: '3',
				name: 'leaf',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=44',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			},
			{
				id: '4',
				name: 'coffe everytime',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=55',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			},
			{
				id: '5',
				name: 'cactus',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=66',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			}
		],
		common: [
			{
				id: '6',
				name: 'alice wonder',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=11',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			},
			{
				id: '7',
				name: 'bob builder',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=13',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			}
		],
		missing: [
			{
				id: '8',
				name: 'charlie brown',
				npub: 'npub1xxxx...zzzz',
				picture: 'https://i.pravatar.cc/150?img=14',
				bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vel porttitor eros, ut maximus nulla. Fusce finibus sit amet nisl id...'
			}
		]
	};
</script>

<div class="min-h-screen bg-gray-50 px-4 py-20">
	<div class="mx-auto max-w-2xl space-y-8">
		<!-- Profile Comparison Header -->
		<div class="flex items-center justify-center gap-6">
			<div class="flex items-center gap-3">
				<img src={currentUser.picture} alt={currentUser.name} class="h-16 w-16 rounded-full" />
				<div>
					<h2 class="text-xl font-medium text-gray-900">{currentUser.name}</h2>
					<p class="text-sm text-gray-500">{currentUser.npub}</p>
				</div>
			</div>

			<svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>

			<div class="flex items-center gap-3">
				<img
					src={comparedProfile.picture}
					alt={comparedProfile.name}
					class="h-16 w-16 rounded-full"
				/>
				<div>
					<h2 class="text-xl font-medium text-gray-900">{comparedProfile.name}</h2>
					<p class="text-sm text-gray-500">{comparedProfile.npub}</p>
				</div>
			</div>
		</div>

		<!-- Reports -->
		<div class="space-y-3">
			<p class="leading-6 text-gray-900">
				Your most recent contacts list has been updated on
				<span class="font-medium">{currentUser.lastUpdated}</span>
				and it contains <span class="font-medium">{currentUser.contactsCount}</span> people.
			</p>

			<p class="leading-6 text-gray-900">
				<span class="font-medium">{comparedProfile.name}</span> has
				<span class="font-medium">{comparedProfile.contactsCount}</span>
				people in his contact list and
				<span class="font-medium">{comparedProfile.commonContacts}</span> are in common with you,
				and <span class="font-medium">{comparedProfile.newContacts}</span>
				contacts that you don't follow yet; select one or more contacts to apply an update:
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
		<div class="">
			{#each allContacts[activeTab] as contact (contact.id)}
				<div
					class="flex cursor-pointer gap-4 border-b-3 border-gray-200 p-4 transition-colors hover:bg-gray-100"
				>
					<img
						src={contact.picture}
						alt={contact.name}
						class="h-14 w-14 flex-shrink-0 rounded-full"
					/>
					<div class="flex-1">
						<h3 class="text-xl font-medium text-gray-900">{contact.name}</h3>
						<p class="text-sm text-gray-500">{contact.npub}</p>
						<p class="mt-1 leading-5 text-gray-700">{contact.bio}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';

	let hasNip07Extension = $state(false);
	let isCheckingExtension = $state(false);
	let showNostrConnect = $state(false);

	onMount(() => {
		// Check if window.nostr exists and is not the fake one from window.nostr.js
		hasNip07Extension = typeof window.nostr !== 'undefined' && window.nostr._fake !== true;
	});

	function handleExtensionLogin() {
		isCheckingExtension = true;
		console.log('Extension login clicked');
	}

	function handleNostrConnectLogin() {
		showNostrConnect = true;
		console.log('Nostr Connect login clicked');
	}

	function handleNpubLogin() {
		console.log('Npub login clicked');
	}
</script>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h1 class="mb-4 text-4xl font-bold text-gray-900">Nostr Contacts Manager</h1>
			<p class="leading-5 text-gray-600">
				Compare your Nostr contacts with others, discover new people to follow, and improve your
				contact list with ease. Add new contacts or unfollow with just a few clicks!
			</p>
		</div>

		<div class="flex flex-col items-center space-y-4">
			{#if hasNip07Extension}
				<!-- NIP-07 extension detected -->
				<button
					onclick={handleExtensionLogin}
					disabled={isCheckingExtension}
					class="cursor-pointer rounded-lg bg-accent px-8 py-4 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
				>
					<div class="text-center">
						<div class="text-2xl">Start managing your contacts</div>
						<div class="text-sm">
							{isCheckingExtension ? 'Checking extension...' : 'Login via extension'}
						</div>
					</div>
				</button>

				<div class="flex flex-col items-center space-y-2">
					<button
						onclick={handleNostrConnectLogin}
						class="cursor-pointer text-center text-sm font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
					>
						Login via Nostr Connect or Nsec
					</button>

					<button
						onclick={handleNpubLogin}
						class="cursor-pointer text-center text-sm font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
					>
						Login in read-only mode via Npub
					</button>
				</div>
			{:else}
				<!-- No NIP-07 extension detected -->
				<button
					onclick={handleNostrConnectLogin}
					class="cursor-pointer rounded-lg bg-accent px-8 py-4 font-medium text-white transition-colors hover:bg-accent-hover"
				>
					<div class="text-center">
						<div class="text-2xl">Start managing your contacts</div>
						<div class="text-sm">Login via Nostr Connect / Nsec</div>
					</div>
				</button>

				<button
					onclick={handleNpubLogin}
					class="cursor-pointer text-sm font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
				>
					Login in read-only mode via Npub
				</button>
			{/if}
		</div>
	</div>
</div>

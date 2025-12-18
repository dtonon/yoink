<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19 } from 'nostr-tools';

	let hasNip07Extension = $state(false);
	let isCheckingExtension = $state(false);
	let showNostrConnect = $state(false);
	let errorMessage = $state('');

	let userPubkey = $state<string>(''); // Hex format
	let userNpub = $state<string>(''); // Npub format

	onMount(() => {
		// Check if window.nostr exists and is not the fake one from window.nostr.js
		hasNip07Extension = typeof window.nostr !== 'undefined' && window.nostr._fake !== true;

		// Check if user is already logged in
		const savedPubkey = localStorage.getItem('userPubkey');
		if (savedPubkey) {
			userPubkey = savedPubkey;
			userNpub = nip19.npubEncode(savedPubkey);

			// TODO: redirect to the contacts view
		}
	});

	async function handleExtensionLogin() {
		isCheckingExtension = true;
		errorMessage = '';

		try {
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Extension request timed out')), 10000);
			});

			const pubkeyPromise = window.nostr!.getPublicKey();

			const pubkey = (await Promise.race([pubkeyPromise, timeoutPromise])) as string;

			if (pubkey) {
				userPubkey = pubkey;
				userNpub = nip19.npubEncode(pubkey);
				localStorage.setItem('userPubkey', pubkey);

				alert(`Login successful!\nPubkey: ${pubkey}\nNpub: ${userNpub}`);
			}
		} catch (error) {
			console.error('Extension login error:', error);
			errorMessage =
				'Failed to get public key from extension, please make sure you approved the request.';
		} finally {
			isCheckingExtension = false;
		}
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
			{#if errorMessage}
				<div
					class="w-full rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800"
				>
					{errorMessage}
				</div>
			{/if}

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

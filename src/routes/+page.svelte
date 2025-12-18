<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19 } from 'nostr-tools';

	let hasNip07Extension = $state(false);
	let isLoggingIn = $state(false);
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

	async function handleLogin() {
		isLoggingIn = true;
		errorMessage = '';

		try {
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Login request timed out')), 60_000);
			});

			const pubkeyPromise = window.nostr!.getPublicKey();

			const pubkey = (await Promise.race([pubkeyPromise, timeoutPromise])) as string;

			if (pubkey) {
				userPubkey = pubkey;
				userNpub = nip19.npubEncode(pubkey);
				localStorage.setItem('userPubkey', pubkey);

				// TODO: redirect to the contacts view
				alert(`Login successful!\nPubkey: ${pubkey}\nNpub: ${userNpub}`);
			}
		} catch (error) {
			console.error('Login error:', error);

			if (error instanceof Error && error.message.includes('User rejected')) {
				errorMessage = 'Login cancelled.';
			} else {
				errorMessage = 'Failed to login. Please make sure you approved the request.';
			}
		} finally {
			isLoggingIn = false;
		}
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

			<button
				onclick={handleLogin}
				disabled={isLoggingIn}
				class="cursor-pointer rounded-lg bg-accent px-8 py-4 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
			>
				<div class="text-center">
					<div class="text-2xl">Start managing your contacts</div>
					<div class="text-sm">
						{#if isLoggingIn}
							Logging in...
						{:else if hasNip07Extension}
							Login via extension
						{:else}
							Login via Nostr Connect / Nsec
						{/if}
					</div>
				</div>
			</button>

			<button
				onclick={handleNpubLogin}
				class="cursor-pointer text-sm font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
			>
				Login in read-only mode via Npub
			</button>
		</div>
	</div>
</div>

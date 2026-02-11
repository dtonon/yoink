<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { nip19 } from 'nostr-tools';
	import { queryProfile } from 'nostr-tools/nip05';
	import { focusInput } from '$lib/actions';

	let hasNip07Extension = $state(false);
	let isLoggingIn = $state(false);
	let errorMessage = $state('');
	let showNpubModal = $state(false);
	let npubInput = $state('');
	let npubError = $state('');

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let userPubkey = $state<string>(''); // Hex format
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let userNpub = $state<string>(''); // Npub format

	function waitForNostr(timeout = 2000): Promise<boolean> {
		return new Promise((resolve) => {
			if (typeof window.nostr !== 'undefined' && window.nostr._fake !== true) {
				return resolve(true);
			}

			const interval = setInterval(() => {
				if (typeof window.nostr !== 'undefined' && window.nostr._fake !== true) {
					clearInterval(interval);
					resolve(true);
				}
			}, 50);

			setTimeout(() => {
				clearInterval(interval);
				resolve(false);
			}, timeout);
		});
	}

	onMount(async () => {
		// Check if window.nostr exists and is not the fake one from window.nostr.js
		hasNip07Extension = await waitForNostr();

		// Check if user is already logged in
		const savedPubkey = localStorage.getItem('userPubkey');
		if (savedPubkey) {
			userPubkey = savedPubkey;
			userNpub = nip19.npubEncode(savedPubkey);

			goto('/search');
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
				localStorage.setItem('loginMode', 'full');

				goto('/search');
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
		errorMessage = '';
		npubError = '';
		npubInput = '';
		showNpubModal = true;
	}

	function cancelNpubLogin() {
		showNpubModal = false;
		npubInput = '';
		npubError = '';
	}

	async function confirmNpubLogin() {
		npubError = '';

		if (!npubInput.trim()) {
			npubError = 'Please enter a valid npub, nprofile, or NIP-05 identifier';
			return;
		}

		isLoggingIn = true;
		const input = npubInput.trim();

		// Check if input looks like an email (name@domain.com)
		const looksLikeEmail = input.includes('@');

		// Check if input looks like a domain (domain.com)
		const looksLikeDomain =
			input.includes('.') && !input.startsWith('npub') && !input.startsWith('nprofile');

		try {
			let pubkeyHex: string | undefined;

			if (looksLikeEmail || looksLikeDomain) {
				// NIP-05 lookup
				const profile = await queryProfile(input);
				if (profile && profile.pubkey) {
					pubkeyHex = profile.pubkey;
				} else {
					npubError = 'NIP-05 identifier not found or invalid';
					isLoggingIn = false;
					return;
				}
			} else if (input.startsWith('npub') || input.startsWith('nprofile')) {
				// npub/nprofile decoding
				const decoded = nip19.decode(input);
				if (decoded.type !== 'npub' && decoded.type !== 'nprofile') {
					npubError = 'Invalid npub or nprofile';
					isLoggingIn = false;
					return;
				}
				pubkeyHex = decoded.type === 'npub' ? decoded.data : decoded.data.pubkey;
			} else {
				npubError = 'Invalid format. Please enter a npub, nprofile, or NIP-05 identifier';
				isLoggingIn = false;
				return;
			}

			userPubkey = pubkeyHex;
			userNpub = nip19.npubEncode(pubkeyHex);
			localStorage.setItem('userPubkey', pubkeyHex);
			localStorage.setItem('loginMode', 'read');

			showNpubModal = false;
			isLoggingIn = false;
			goto('/search');
		} catch (error) {
			console.error('Login error:', error);
			npubError = 'Invalid format or lookup failed. Please try again';
			isLoggingIn = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center px-8 sm:px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<img src="/logo.png" alt="logo" class="mx-auto w-3xs sm:w-2xs" />
			<h1 class="mb-4 text-4xl font-bold text-gray-900">Yoink</h1>
			<p class="leading-5 text-gray-600">
				Compare your Nostr contacts with others, discover new people to follow, and yoink their best
				contacts with just a few clicks!
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
					<div class="text-2xl leading-6">Start managing your contacts</div>
					<div class="mt-2 text-sm">
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

<!-- Npub Login Modal -->
{#if showNpubModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
		transition:fade={{ duration: 150 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="npub-dialog-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) cancelNpubLogin();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') cancelNpubLogin();
		}}
	>
		<div
			class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
			transition:fade={{ duration: 150 }}
		>
			<h2 id="npub-dialog-title" class="mb-4 text-xl font-semibold text-gray-900">
				Read-only login
			</h2>
			<p class="mb-4 text-sm text-gray-600">
				Enter your npub, nprofile, or NIP-05 identifier to login in read-only mode. You'll be able
				to view and compare contacts, but won't be able to update your contact list.
			</p>
			<div class="mb-4">
				<label for="npub-input" class="mb-2 block text-sm font-medium text-gray-700">
					Npub, nprofile, or NIP-05
				</label>
				<input
					id="npub-input"
					type="text"
					bind:value={npubInput}
					placeholder="npub1..., nprofile1..., or name@domain.com"
					disabled={isLoggingIn}
					use:focusInput
					class="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
					onkeydown={(e) => {
						if (e.key === 'Enter' && !isLoggingIn) confirmNpubLogin();
					}}
				/>
				{#if npubError}
					<p class="mt-2 text-sm text-red-600">{npubError}</p>
				{/if}
			</div>
			<div class="flex gap-3">
				<button
					onclick={cancelNpubLogin}
					disabled={isLoggingIn}
					class="flex-1 cursor-pointer rounded-lg bg-gray-200 px-4 py-3 font-medium text-gray-800 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={confirmNpubLogin}
					disabled={isLoggingIn}
					class="flex-1 cursor-pointer rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isLoggingIn ? 'Loading...' : 'Login'}
				</button>
			</div>
		</div>
	</div>
{/if}

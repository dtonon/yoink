import { comparisonStore } from '$lib/store';

export function logout() {
	localStorage.removeItem('userPubkey');
	localStorage.removeItem('loginMode');
	localStorage.removeItem('targetPubkey');
	comparisonStore.set(null);
}

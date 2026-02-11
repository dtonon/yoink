export function focusInput(node: HTMLInputElement) {
	// Only auto-focus on desktop (screen width > 768px)
	if (window.innerWidth > 768) {
		node.focus();
	}
}

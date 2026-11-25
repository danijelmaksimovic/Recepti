/** Small decorative illustrations for empty states, drawn in the app palette. */
export function CookbookArt() {
  return (
    <svg width="132" height="96" viewBox="0 0 132 96" fill="none" aria-hidden="true">
      <rect x="20" y="14" width="56" height="72" rx="8" transform="rotate(-8 20 14)" fill="var(--herb-soft)" />
      <rect x="54" y="10" width="56" height="72" rx="8" transform="rotate(7 54 10)" fill="var(--accent-soft)" />
      <rect x="38" y="16" width="56" height="72" rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      <path d="M48 32h36M48 42h28M48 52h32" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
      <path d="M70 76c0-12 6-20 15-22 1 10-4 20-15 22Z" fill="var(--herb)" />
      <circle cx="54" cy="70" r="7" fill="var(--accent)" />
    </svg>
  )
}

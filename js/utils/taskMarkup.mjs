export function joinMarkup(...parts) {
  return parts.filter(Boolean).join('');
}

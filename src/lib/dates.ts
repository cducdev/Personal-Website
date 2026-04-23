const postDateFormatter = new Intl.DateTimeFormat('en-US', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
});

export function formatPostDate(date: Date) {
	return postDateFormatter.format(date);
}

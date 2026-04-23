import type { APIRoute } from 'astro';

import { savePost } from '../../../lib/blog';
import { checkWriteAccess, createWriteAccessResponse } from '../../../lib/write-access';

export const POST: APIRoute = async ({ request }) => {
	const access = checkWriteAccess(request);

	if (!access.ok) {
		return createWriteAccessResponse(access);
	}

	try {
		const payload = await request.json();
		const tags = Array.isArray(payload.tags) ? payload.tags : String(payload.tags ?? '').split(',');
		const result = await savePost({
			title: String(payload.title ?? ''),
			description: String(payload.description ?? ''),
			body: String(payload.body ?? ''),
			pubDate: String(payload.pubDate ?? ''),
			tags: tags.map((tag) => String(tag)),
			status: payload.status ? String(payload.status) : undefined,
			language: payload.language ? String(payload.language) : undefined,
			slug: payload.slug ? String(payload.slug) : undefined,
			originalSlug: payload.originalSlug ? String(payload.originalSlug) : undefined,
		});

		return Response.json({
			ok: true,
			slug: result.slug,
			updated: result.updated,
			url: `/blog/${result.slug}/`,
		});
	} catch (error) {
		return Response.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Could not save post.',
			},
			{ status: 400 },
		);
	}
};

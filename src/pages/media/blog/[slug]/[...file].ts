import path from 'node:path';

import type { APIRoute } from 'astro';

import { readRuntimeImage } from '../../../../lib/blog';

const contentTypes = new Map([
	['.png', 'image/png'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.webp', 'image/webp'],
	['.gif', 'image/gif'],
	['.avif', 'image/avif'],
]);

export const GET: APIRoute = async ({ params }) => {
	const slug = params.slug ?? '';
	const fileParts = (params.file ?? '').split('/').filter(Boolean);

	if (fileParts.length === 0) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const buffer = await readRuntimeImage(slug, fileParts);

		if (!buffer) {
			return new Response('Not found', { status: 404 });
		}

		const extension = path.extname(fileParts[fileParts.length - 1]).toLowerCase();
		const contentType = contentTypes.get(extension) ?? 'application/octet-stream';

		return new Response(buffer, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
	} catch {
		return new Response('Not found', { status: 404 });
	}
};

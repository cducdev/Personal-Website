import type { APIRoute } from 'astro';

import { saveRuntimeImage } from '../../../lib/blog';
import { checkWriteAccess, createWriteAccessResponse } from '../../../lib/write-access';

export const POST: APIRoute = async ({ request }) => {
	const access = checkWriteAccess(request);

	if (!access.ok) {
		return createWriteAccessResponse(access);
	}

	try {
		const formData = await request.formData();
		const slug = String(formData.get('slug') ?? '');
		const image = formData.get('image');

		if (!(image instanceof File)) {
			return Response.json(
				{
					ok: false,
					error: 'Image file is required.',
				},
				{ status: 400 },
			);
		}

		const result = await saveRuntimeImage(slug, image);

		return Response.json({
			ok: true,
			url: result.url,
			fileName: result.fileName,
		});
	} catch (error) {
		return Response.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Could not upload image.',
			},
			{ status: 400 },
		);
	}
};

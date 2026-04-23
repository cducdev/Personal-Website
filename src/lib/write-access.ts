import type { APIContext } from 'astro';

const realm = 'ducdev-write';

function decodeAuthHeader(header: string | null) {
	if (!header || !header.startsWith('Basic ')) {
		return null;
	}

	try {
		const payload = header.slice('Basic '.length);
		const decoded = Buffer.from(payload, 'base64').toString('utf8');
		const separatorIndex = decoded.indexOf(':');

		if (separatorIndex === -1) {
			return null;
		}

		return {
			username: decoded.slice(0, separatorIndex),
			password: decoded.slice(separatorIndex + 1),
		};
	} catch {
		return null;
	}
}

function readConfiguredCredentials() {
	return {
		username: process.env.WRITE_USER?.trim() ?? '',
		password: process.env.WRITE_PASSWORD ?? '',
	};
}

export function checkWriteAccess(request: Request) {
	const configured = readConfiguredCredentials();
	const isDev = process.env.NODE_ENV !== 'production';

	if (!configured.username || !configured.password) {
		if (isDev) {
			return { ok: true as const };
		}

		return {
			ok: false as const,
			status: 500,
			message: 'WRITE_USER and WRITE_PASSWORD must be configured on the server.',
		};
	}

	const provided = decodeAuthHeader(request.headers.get('authorization'));

	if (
		provided &&
		provided.username === configured.username &&
		provided.password === configured.password
	) {
		return { ok: true as const };
	}

	return {
		ok: false as const,
		status: 401,
		message: 'Authentication required.',
		headers: {
			'WWW-Authenticate': `Basic realm="${realm}"`,
		},
	};
}

export function createWriteAccessResponse(result: ReturnType<typeof checkWriteAccess>) {
	if (result.ok) {
		return null;
	}

	return new Response(result.message, {
		status: result.status,
		headers: result.headers,
	});
}

export function applyWriteAccessToPage(context: APIContext) {
	const result = checkWriteAccess(context.request);

	if (result.ok) {
		return {
			authorized: true as const,
			message: '',
		};
	}

	context.response.status = result.status;

	if (result.headers) {
		for (const [key, value] of Object.entries(result.headers)) {
			context.response.headers.set(key, value);
		}
	}

	return {
		authorized: false as const,
		message: result.message,
	};
}

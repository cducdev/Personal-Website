const fs = require('node:fs');
const path = require('node:path');

const cwd = '/var/www/ducdev.io.vn/current';

function readEnvFile(filePath) {
	try {
		const source = fs.readFileSync(filePath, 'utf8');
		const result = {};

		for (const rawLine of source.split(/\r?\n/)) {
			const line = rawLine.trim();

			if (!line || line.startsWith('#')) {
				continue;
			}

			const separatorIndex = line.indexOf('=');

			if (separatorIndex === -1) {
				continue;
			}

			const key = line.slice(0, separatorIndex).trim();
			const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

			if (key) {
				result[key] = value;
			}
		}

		return result;
	} catch {
		return {};
	}
}

const fileEnv = readEnvFile(path.join(cwd, '.env'));
const runtimeEnv = {
	...process.env,
	...fileEnv,
	NODE_ENV: 'production',
	HOST: fileEnv.HOST || process.env.HOST || '127.0.0.1',
	PORT: fileEnv.PORT || process.env.PORT || '4321',
};

module.exports = {
	apps: [
		{
			name: 'ducdev-io-vn',
			cwd,
			script: './dist/server/entry.mjs',
			interpreter: 'node',
			exec_mode: 'fork',
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: '300M',
			env: runtimeEnv,
		},
	],
};

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const cwd = process.cwd();
const postsDir = path.join(cwd, 'content', 'blog');
const imagesRootDir = path.join(cwd, 'storage', 'blog-images');

const argv = process.argv.slice(2);

function getFlag(name) {
	const flag = `--${name}`;
	const index = argv.indexOf(flag);

	if (index === -1) {
		return undefined;
	}

	return argv[index + 1];
}

function hasFlag(name) {
	return argv.includes(`--${name}`);
}

function pad(value) {
	return String(value).padStart(2, '0');
}

function formatDate(date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slugify(value) {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function escapeYaml(value) {
	return JSON.stringify(value);
}

function normalizeTags(value) {
	return value
		.split(',')
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function buildPostContent({ title, description, pubDate, tags, imagePath }) {
	const tagLines = tags.length > 0 ? tags.map((tag) => `  - ${tag}`).join('\n') : '  - security';

	return `---
title: ${escapeYaml(title)}
description: ${escapeYaml(description)}
pubDate: ${pubDate}
tags:
${tagLines}
draft: true
---

## Mo dau

Viet noi dung bai viet o day.

![Mo ta anh](${imagePath}/cover.png)
`;
}

async function prompt(question, fallback = '') {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		const answer = await rl.question(question);
		return answer.trim() || fallback;
	} finally {
		rl.close();
	}
}

async function main() {
	const today = formatDate(new Date());
	const titleArg = getFlag('title');
	const descriptionArg = getFlag('description');
	const tagsArg = getFlag('tags');
	const dateArg = getFlag('date') ?? today;
	const yes = hasFlag('yes');
	const dryRun = hasFlag('dry-run');

	const title = titleArg ?? (yes ? '' : await prompt('Post title: '));

	if (!title) {
		console.error('Missing post title. Use --title "Your title" or run without --yes.');
		process.exit(1);
	}

	const slugArg = getFlag('slug');
	const slug = slugArg ?? slugify(title);

	if (!slug) {
		console.error('Could not generate a slug. Try passing --slug manually.');
		process.exit(1);
	}

	const description =
		descriptionArg ?? (yes ? 'Short summary for this post.' : await prompt('Description: ', 'Short summary for this post.'));
	const tags =
		normalizeTags(
			tagsArg ??
				(yes ? 'security' : await prompt('Tags (comma separated): ', 'security')),
		);

	const postFile = path.join(postsDir, `${slug}.md`);
	const imageDir = path.join(imagesRootDir, slug);
	const imagePath = `/media/blog/${slug}`;
	const postContent = buildPostContent({
		title,
		description,
		pubDate: dateArg,
		tags,
		imagePath,
	});

	if (dryRun) {
		console.log(`Post file: ${postFile}`);
		console.log(`Image dir: ${imageDir}`);
		console.log('');
		console.log(postContent);
		return;
	}

	await mkdir(postsDir, { recursive: true });
	await mkdir(imageDir, { recursive: true });
	await writeFile(postFile, postContent, { flag: 'wx' });
	await writeFile(path.join(imageDir, '.gitkeep'), '', { flag: 'wx' }).catch(() => {});

	console.log(`Created ${path.relative(cwd, postFile)}`);
	console.log(`Created ${path.relative(cwd, imageDir)}/`);
	console.log(`Image path for Markdown: ${imagePath}/cover.png`);
	console.log('');
	console.log('Next steps:');
	console.log(`1. Put images into ${path.relative(cwd, imageDir)}/`);
	console.log(`2. Edit ${path.relative(cwd, postFile)}`);
	console.log('3. Change draft: true to draft: false when ready');
}

main().catch((error) => {
	if (error && error.code === 'EEXIST') {
		console.error('Post or image folder already exists. Use --slug to choose a different slug.');
		process.exit(1);
	}

	console.error(error);
	process.exit(1);
});

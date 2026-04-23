import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true,
});

const cwd = process.cwd();

export const runtimePostsDir = path.join(cwd, 'content', 'blog');
export const sourcePostsDir = path.join(cwd, 'src', 'content', 'blog');
export const runtimeImageRootDir = path.join(cwd, 'storage', 'blog-images');

const postDirs = [runtimePostsDir, sourcePostsDir];
const slugPattern = /^[a-z0-9-]+$/;
const imageMimeExtensions = new Map([
	['image/png', '.png'],
	['image/jpeg', '.jpg'],
	['image/webp', '.webp'],
	['image/gif', '.gif'],
	['image/avif', '.avif'],
]);

export const blogStatusValues = ['draft', 'hidden', 'published'] as const;
export type BlogPostStatus = (typeof blogStatusValues)[number];
const allowedStatuses = new Set(blogStatusValues);

export interface BlogPost {
	slug: string;
	title: string;
	description: string;
	pubDate: Date;
	updatedDate?: Date;
	tags: string[];
	status: BlogPostStatus;
	body: string;
	html: string;
	sourcePath: string;
	sourceKind: 'runtime' | 'source';
}

export interface SavePostInput {
	title: string;
	description: string;
	body: string;
	pubDate: string;
	tags: string[];
	status?: string;
	language?: string;
	slug?: string;
	originalSlug?: string;
}

const languageTagPattern = /^(en|vi)$/i;

function normalizeLanguageTag(value: unknown) {
	if (!value) {
		return undefined;
	}

	const normalized = String(value).trim().toLowerCase();
	return normalized === 'en' || normalized === 'vi' ? normalized : undefined;
}

function dedupeTags(tags: string[]) {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const rawTag of tags) {
		const tag = rawTag.trim();

		if (!tag) {
			continue;
		}

		const normalized = tag.toLowerCase();

		if (seen.has(normalized)) {
			continue;
		}

		seen.add(normalized);
		result.push(languageTagPattern.test(normalized) ? normalized : tag);
	}

	return result;
}

function toDate(value: unknown, fieldName: string) {
	const date = value instanceof Date ? value : new Date(String(value ?? ''));

	if (Number.isNaN(date.valueOf())) {
		throw new Error(`Invalid ${fieldName}.`);
	}

	return date;
}

function normalizeTags(value: unknown) {
	if (!value) {
		return [];
	}

	if (Array.isArray(value)) {
		return dedupeTags(value.map((tag) => String(tag)));
	}

	return dedupeTags(String(value).split(','));
}

function applyLanguageTag(tags: string[], language: unknown) {
	const normalizedLanguage = normalizeLanguageTag(language);

	if (!normalizedLanguage) {
		return tags;
	}

	const withoutLanguageTags = tags.filter((tag) => !languageTagPattern.test(tag));
	return dedupeTags([normalizedLanguage, ...withoutLanguageTags]);
}

function normalizeStatus(value: unknown): BlogPostStatus {
	const normalized = String(value ?? 'draft').trim().toLowerCase();
	return allowedStatuses.has(normalized) ? (normalized as BlogPostStatus) : 'draft';
}

function statusFromLegacyFields(data: Record<string, unknown>): BlogPostStatus {
	if (Boolean(data.draft)) {
		return 'draft';
	}

	const normalizedVisibility = String(data.visibility ?? 'public').trim().toLowerCase();
	return normalizedVisibility === 'hidden' ? 'hidden' : 'published';
}

function isPublished(post: Pick<BlogPost, 'status'>) {
	return post.status === 'published';
}

function normalizeSlug(value: string) {
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

function safeSlug(value: string) {
	const slug = normalizeSlug(value);

	if (!slug || !slugPattern.test(slug)) {
		throw new Error('Invalid slug.');
	}

	return slug;
}

function escapeYaml(value: string) {
	return JSON.stringify(value);
}

function buildFrontmatter({
	title,
	description,
	pubDate,
	updatedDate,
	tags,
	status,
}: Omit<BlogPost, 'slug' | 'body' | 'html' | 'sourcePath' | 'sourceKind'>) {
	const tagBlock = tags.length > 0 ? `tags:\n${tags.map((tag) => `  - ${tag}`).join('\n')}` : 'tags: []';
	const updatedLine = updatedDate ? `updatedDate: ${updatedDate.toISOString().slice(0, 10)}\n` : '';

	return `---
title: ${escapeYaml(title)}
description: ${escapeYaml(description)}
pubDate: ${pubDate.toISOString().slice(0, 10)}
${updatedLine}${tagBlock}
status: ${status}
---`;
}

function toSourceKind(filePath: string): BlogPost['sourceKind'] {
	return filePath.startsWith(runtimePostsDir) ? 'runtime' : 'source';
}

function parsePost(filePath: string, rawSource: string) {
	const parsed = matter(rawSource);
	const data = parsed.data as Record<string, unknown>;
	const slug = path.basename(filePath, path.extname(filePath));

	if (!slugPattern.test(slug)) {
		return null;
	}

	const title = String(data.title ?? '').trim();
	const description = String(data.description ?? '').trim();

	if (!title || !description) {
		throw new Error(`Missing title/description in ${filePath}.`);
	}

	const pubDate = toDate(data.pubDate, 'pubDate');
	const updatedDate = data.updatedDate ? toDate(data.updatedDate, 'updatedDate') : undefined;
	const tags = applyLanguageTag(normalizeTags(data.tags), data.language ?? data.lang);
	const status = data.status ? normalizeStatus(data.status) : statusFromLegacyFields(data);
	const body = parsed.content.trim();

	return {
		slug,
		title,
		description,
		pubDate,
		updatedDate,
		tags,
		status,
		body,
		html: markdown.render(body),
		sourcePath: filePath,
		sourceKind: toSourceKind(filePath),
	} satisfies BlogPost;
}

async function readPostFromPath(filePath: string) {
	const source = await readFile(filePath, 'utf8');
	return parsePost(filePath, source);
}

async function listFilesInDir(dir: string) {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
			.map((entry) => path.join(dir, entry.name));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}

		throw error;
	}
}

export async function listPosts(
	options: { includeDraft?: boolean; includeUnpublished?: boolean } = {},
) {
	const includeUnpublished = options.includeUnpublished ?? options.includeDraft ?? false;

	const postMap = new Map<string, BlogPost>();

	for (const dir of postDirs) {
		const files = await listFilesInDir(dir);

		for (const filePath of files) {
			const post = await readPostFromPath(filePath);

			if (!post) {
				continue;
			}

			if (!includeUnpublished && !isPublished(post)) {
				continue;
			}

			if (!postMap.has(post.slug)) {
				postMap.set(post.slug, post);
			}
		}
	}

	return [...postMap.values()].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export async function getPostBySlug(
	slug: string,
	options: { includeDraft?: boolean; includeUnpublished?: boolean } = {},
) {
	const includeUnpublished = options.includeUnpublished ?? options.includeDraft ?? false;

	const safe = safeSlug(slug);

	for (const dir of postDirs) {
		const postPath = path.join(dir, `${safe}.md`);

		try {
			const post = await readPostFromPath(postPath);

			if (!post) {
				continue;
			}

			if (!includeUnpublished && !isPublished(post)) {
				return null;
			}

			return post;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				continue;
			}

			throw error;
		}
	}

	return null;
}

export function slugifyTitle(title: string) {
	return safeSlug(title);
}

export async function savePost(input: SavePostInput) {
	const title = input.title.trim();
	const description = input.description.trim();
	const body = input.body.trim();

	if (!title || !description || !body) {
		throw new Error('Title, description, and content are required.');
	}

	const slug = input.slug ? safeSlug(input.slug) : safeSlug(title);
	const originalSlug = input.originalSlug ? safeSlug(input.originalSlug) : slug;
	const now = new Date();
	const existingPost = await getPostBySlug(originalSlug, { includeUnpublished: true });
	const pubDate = toDate(input.pubDate, 'pubDate');
	const updatedDate = existingPost ? now : undefined;
	const tags = applyLanguageTag(normalizeTags(input.tags), input.language);
	const status = normalizeStatus(input.status);
	const postDir = existingPost ? path.dirname(existingPost.sourcePath) : runtimePostsDir;
	const postPath = path.join(postDir, `${slug}.md`);

	if (slug !== originalSlug) {
		const conflictingPost = await getPostBySlug(slug, { includeUnpublished: true });

		if (conflictingPost && conflictingPost.sourcePath !== existingPost?.sourcePath) {
			throw new Error('Another post already uses this slug.');
		}
	}

	const frontmatter = buildFrontmatter({
		title,
		description,
		pubDate,
		updatedDate,
		tags,
		status,
	});

	await mkdir(postDir, { recursive: true });
	await writeFile(postPath, `${frontmatter}\n\n${body}\n`);

	if (existingPost && existingPost.sourcePath !== postPath) {
		await rm(existingPost.sourcePath);
	}

	return {
		slug,
		postPath,
		updated: Boolean(existingPost),
	};
}

function safeImageBaseName(fileName: string) {
	const parsed = path.parse(fileName);
	return normalizeSlug(parsed.name) || 'image';
}

export function runtimeImageUrl(slug: string, fileName: string) {
	return `/media/blog/${safeSlug(slug)}/${encodeURIComponent(fileName)}`;
}

export async function saveRuntimeImage(slug: string, file: File) {
	const safe = safeSlug(slug);
	const extension = imageMimeExtensions.get(file.type);

	if (!extension) {
		throw new Error('Only PNG, JPG, WEBP, GIF, and AVIF images are allowed.');
	}

	const buffer = Buffer.from(await file.arrayBuffer());

	if (buffer.byteLength === 0) {
		throw new Error('Image file is empty.');
	}

	if (buffer.byteLength > 8 * 1024 * 1024) {
		throw new Error('Image is too large. Maximum size is 8 MB.');
	}

	const imageDir = path.join(runtimeImageRootDir, safe);
	const fileName = `${Date.now()}-${safeImageBaseName(file.name)}${extension}`;
	const filePath = path.join(imageDir, fileName);

	await mkdir(imageDir, { recursive: true });
	await writeFile(filePath, buffer);

	return {
		fileName,
		filePath,
		url: runtimeImageUrl(safe, fileName),
	};
}

export async function readRuntimeImage(slug: string, fileParts: string[]) {
	const safe = safeSlug(slug);
	const targetPath = path.resolve(runtimeImageRootDir, safe, ...fileParts);
	const allowedRoot = path.resolve(runtimeImageRootDir, safe);

	if (!targetPath.startsWith(`${allowedRoot}${path.sep}`) && targetPath !== allowedRoot) {
		return null;
	}

	try {
		return await readFile(targetPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}

		throw error;
	}
}

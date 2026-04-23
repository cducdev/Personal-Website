# ducdev.io.vn

Personal site and runtime-backed blog built with Astro.

## Requirements

- Node `22.12.0` or newer
- npm
- A VPS or server where the project can run as a long-lived Node process

Use `.nvmrc` if you want your local version to match production quickly.

## Commands

```sh
npm install
npm run dev
npm run build
npm run start
```

If you run `npm run start` directly in production without PM2, export your environment variables in the shell first.

## Blog Storage

- Runtime blog posts are stored in `content/blog/`.
- Source fallback posts live in `src/content/blog/`.
- Runtime-uploaded images are stored in `storage/blog-images/`.
- Images are served through `/media/blog/<slug>/<file>`.

This app is easiest to operate by deploying the project in place on the VPS and updating it with `git pull`. The app writes posts and images to the local filesystem, so do not treat it like a static export.

## Admin

- Public blog: `/blog/`
- Post manager: `/admin/posts/`
- New post: `/admin/posts/new/`
- Edit post: `/admin/posts/<slug>/edit/`
- `/write` now redirects to `/admin/posts/new/`

In local dev, admin routes are open when `WRITE_USER` and `WRITE_PASSWORD` are not set.

In production, set `WRITE_USER` and `WRITE_PASSWORD` so admin routes and write APIs are protected with Basic Auth.

Example:

```sh
cp .env.example .env
```

Then set real values in `.env`:

```sh
WRITE_USER=admin
WRITE_PASSWORD=change-this-to-a-long-random-password
```

## Push To Repo

If this folder is not already a git repository, the shortest path is:

```sh
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

The repository is set up to ignore:

- `dist/`
- `.astro/`
- `node_modules/`
- local env files
- runtime blog data in `content/blog/`
- runtime-uploaded images in `storage/blog-images/`
- local mockups and editor settings

## VPS Deploy

### 1. Clone and install

```sh
git clone <your-repo-url> /var/www/ducdev.io.vn/current
cd /var/www/ducdev.io.vn/current
npm ci
cp .env.example .env
```

Set real values in `.env`, then make sure the runtime folders exist:

```sh
mkdir -p content/blog storage/blog-images
```

### 2. Build

```sh
npm run build
```

### 3. Run with PM2

An example PM2 config is included in `ecosystem.config.cjs`.

Update `cwd` there if your project path is different. The PM2 config reads `.env` from the project root before starting the app, so you do not need a separate dotenv package for production.

Then start it:

```sh
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 4. Reverse proxy with Nginx

An example config is included at `deploy/nginx/ducdev.io.vn.conf`.

Typical flow:

```sh
sudo cp deploy/nginx/ducdev.io.vn.conf /etc/nginx/sites-available/ducdev.io.vn.conf
sudo ln -s /etc/nginx/sites-available/ducdev.io.vn.conf /etc/nginx/sites-enabled/ducdev.io.vn.conf
sudo nginx -t
sudo systemctl reload nginx
```

Then issue HTTPS certificates with Certbot if needed.

## Updating Production

From the project directory on the VPS:

```sh
git pull
npm ci
npm run build
pm2 reload ducdev-io-vn
```

## Important Production Note

Run the app from the project root, not from a copied `dist/` directory alone. The runtime blog store uses `process.cwd()` and expects these folders to exist beside the app:

- `content/blog`
- `storage/blog-images`

Back up those two folders if you care about preserving posts and uploaded images created on the server.

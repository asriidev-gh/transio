# Public legal pages

Static pages for the Play Store listing: privacy policy, terms of service and account deletion.
Google Play needs public URLs for the privacy policy and for account deletion.

## Publish with GitHub Pages

The workflow `.github/workflows/legal-pages.yml` publishes this folder. Every push to `main`
that changes `legal/` deploys the pages again.

One-time setup:

1. Push `main` to GitHub.
2. In the repo open **Settings > Pages > Build and deployment** and set **Source** to
   **GitHub Actions**.
3. Open the **Actions** tab and check that "Publish legal pages" succeeded. You can also run it by hand
   with **Run workflow**.

The pages then appear at `https://<your-github-name>.github.io/<repo-name>/`. For the repo
`asriidev-gh/transio` that is `https://asriidev-gh.github.io/transio/`.

Use these URLs in the Play Console:

| Field | URL |
| --- | --- |
| Privacy policy | `.../privacy.html` |
| Account deletion (data deletion request) | `.../delete-account.html` |

### If the repo is private

GitHub Pages is free only for public repositories on a free account. Making this repo public
exposes all of the source code and its history, so decide that on purpose. If you would rather keep the
code private, create a small separate public repo, copy the `.html` files and `style.css` into its
root, and set **Settings > Pages > Deploy from a branch > main / (root)** there.

## Keep them in sync

The in-app text lives in `apps/mobile/src/data/legal.ts`. When you change one, change the other.

Before launch, update these pages if any of the following changed:

- **Subscriptions:** add RevenueCat and Google Play billing to the list of services in the privacy
  policy, and add billing terms to the terms of service.
- **Crash reporting:** add Sentry (or whichever tool you use) to the list of services.
- **Providers:** the list of speech and AI providers must match what is enabled on the API.
- **Deletion promise:** the deletion page commits to deleting email requests within 30 days. Change
  the number if you cannot meet it.

These pages are a starting point, not legal advice. Have them reviewed before a public launch.

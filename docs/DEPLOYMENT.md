# Deployment

## 1. Configure the profile

1. Open `profile.config.json`.
2. Set `github.username` to the account that will own the profile repository. Workflows can infer it from `GITHUB_REPOSITORY_OWNER`, but setting it explicitly makes local refreshes deterministic.
3. Add only public details you want to share: public name, headline, bio, interests, current research, website, contact, and blog.
4. Add technology names only when you have actually used them.
5. Add up to six real public repositories as `owner/repository` entries in `github.featuredRepositories`.
6. Run `npm run update` to fetch, generate, and validate locally. Without an account configured, the scripts generate honest setup states and make no API request.

The API token is read only from the process environment. Never put it in `profile.config.json`, source files, or committed cache files.

## 2. Create the GitHub profile repository

Create a public repository whose name exactly matches the GitHub username. GitHub displays its README on the user's profile when the repository name matches the account name. Start with an empty remote repository; this workspace already contains the profile files.

The local `.codex/` directory is ignored and is not part of the public profile.

## 3. Push the first commit

From the repository root, configure a local commit identity if Git does not already have one, then connect the new profile repository:

```powershell
git config user.name "YOUR PUBLIC COMMIT NAME"
git config user.email "YOUR COMMIT EMAIL"
git branch -M main
git add -A
git commit -m "feat: initialize GitHub profile"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_USERNAME.git
git push -u origin main
```

Use an email address you are comfortable associating with public commits, or use a GitHub-provided noreply address. The commands above do not configure or print credentials.

## 4. Allow the workflows to save generated files

The workflows use GitHub's automatically provided `GITHUB_TOKEN`; no personal access token secret is required. Each write job declares only `contents: write`.

In the repository, open **Settings → Actions → General → Workflow permissions** and allow read and write permissions for `GITHUB_TOKEN` if the repository's default policy is read-only. Branch protection must also allow this token to push generated commits, or the commits will fail even though the YAML permission is present.

No `PROFILE_STATS_TOKEN`, SSH key, or mail credential is needed. The contribution query is limited to public activity and does not request `read:user` access for private contribution counts.

## 5. Enable and run the workflows

1. Open **Actions** and enable workflows if GitHub asks.
2. Run **Update profile and featured projects**, **Generate GitHub analytics**, and **Generate contribution snake** once with **Run workflow**.
3. Review each workflow summary and the generated files on the default branch.
4. Confirm relative images load on the profile README. The schedule runs each workflow daily at 02:17, 02:27, and 02:37 UTC. Change both `updates.baseTimeUtc` and the matching cron entries if you want a different time.

Scheduled workflows run from the default branch and can be delayed during busy periods. GitHub may disable scheduled workflows in an inactive public repository; check the Actions page if a daily run stops.

## 6. Local commands

```powershell
npm run generate
npm run fetch
npm run stats
npm test
npm run validate
python scripts/validate-workflows.py
```

The full `npm run check` command also parses workflow YAML and needs Python 3 with PyYAML installed. Node.js 22 or newer is required for the generators. `npm run fetch` and `npm run update` need network access; local GitHub GraphQL requests may need an environment `GITHUB_TOKEN` to return the public contribution calendar. Never save that variable in a tracked file.

## Troubleshooting

- **No repository stats:** Check `github.username`, then run the update workflow manually. An empty username intentionally produces setup cards.
- **Selected project missing:** Check the spelling and public visibility of the `owner/repository` entry. The API may return 404 for a private or renamed repository.
- **Rate limit:** Let GitHub's reset window pass. The workflows keep the previous cache and generated images; the refresh status explains that cached data is in use.
- **Workflow cannot push:** Confirm `contents: write`, the repository's Actions permission setting, and branch protection rules.
- **Scheduled run did not occur:** Schedules use UTC, only run from the default branch, and may be delayed or disabled for inactive public repositories.
- **Images are missing:** Check that the generated SVGs are committed on the default branch and that filenames match the README references.
- **GitHub does not play an SVG animation:** The static SVG is still available. The local XML validator cannot verify GitHub's production image proxy behavior.

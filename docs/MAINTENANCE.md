# Maintenance

## Change profile content

Edit `profile.config.json`, then run:

```powershell
npm run update
```

The generator validates the file, refreshes public data when a username is available, updates generated README sections, and verifies SVG XML. Keep the README marker pairs; write custom prose outside the marked blocks.

## Replace the logo or brand

Change `brand.name`, `brand.mark`, or the dark/light color tokens in `profile.config.json`, then run `npm run generate`. The small terminal logo is drawn locally in `scripts/lib/svg.mjs`; edit `renderLogo` there if you want to change its geometry. Do not add scripts or external image references to generated SVGs.

## Add a featured repository

Add its public `owner/repository` name to `github.featuredRepositories` (maximum six) and run `npm run update`. The fetcher asks GitHub for the live description, primary language, stars, and archived state. The card and README list are generated from that returned data; no sample numbers are stored in the configuration.

## Update the technology stack

Add technology names under the matching `technologyStack` category. Keep the list limited to technologies you have used. Each entry receives a neutral two-character monogram; this avoids fetching icon files from an external service. Run `npm run generate` to refresh light and dark SVGs.

## Change analytics

The local stats card deliberately shows three non-duplicated metrics: public repository count, stars across owned public repositories, and primary languages ranked by repository count. The separate contribution calendar and snake use GitHub's public contribution calendar.

To change the update time, edit `updates.baseTimeUtc` and all three cron expressions in `.github/workflows/`. Keep the stat and snake runs offset from the base time, and keep the shared concurrency group so jobs cannot write generated assets at once.

## Refresh action pins

Review upstream security notices and release notes, then replace each 40-character action SHA with the verified commit for the intended release. The workflows pin `actions/checkout` and `Platane/snk`; no third-party summary-card action or hosted typing endpoint is used. Run `python scripts/validate-workflows.py` to reject mutable action tags and malformed workflow structure.

## Recover from failed refreshes

1. Read the failed job's log and the `assets/cache/fetch-status.json` diagnostic.
2. Check whether the failure was an API limit, invalid username, unavailable selected repository, or denied write permission.
3. The fetcher does not replace a valid cache after a failed request. The generated profile cards continue to use the prior same-account cache, and the snake job commits only after a successful output generation.
4. Fix configuration or permissions, then rerun the workflow manually.

## Restore a previous generated state

Every generated update is a normal commit on the profile repository's default branch. To restore one earlier refresh, revert that commit:

```powershell
git revert <generated-commit-sha>
git push
```

To restore only the cached data file, check out its contents from a known-good commit, run `npm run generate`, review the diff, and commit the result. Never restore a cache from a different GitHub username.

## Validation commands

```powershell
npm test
npm run validate
python scripts/validate-workflows.py
```

The test suite covers configuration errors, API aggregation, rate-limit classification, cache retention, XML escaping, and atomic writes. It does not prove that GitHub's hosted Markdown image proxy will play SVG animations; verify that after publishing the profile repository.

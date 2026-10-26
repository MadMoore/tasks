# Tasks

Personal fork of [Vikunja](https://github.com/go-vikunja/vikunja), under the
existing AGPL-3.0-or-later license. The llama, upstream attribution, copyright
notices and technical API/database identifiers are retained.

## Changes

- Tasks branding in the browser title, web logo, installable PWA and compiled
  locale resources. Locale source files stay compatible with upstream.
- Overview's all-tasks section orders by descending priority, then descending ID.
  Date-based upcoming views retain their date ordering.
- New filter-only field `source_bucket_id` (`sourceBucketId` in the UI) matches
  membership in buckets of original project boards, across views. Existing
  `bucket_id` keeps its view-local meaning. No schema migration is added.
- Fork checks run on GitHub's hosted Linux runner. Upstream publication and
  preview workflows are disabled for this fork. There is no automatic deployment.

## Dynamic focus view

Find the IDs of the desired buckets in each original project board using the
API/MCP or board URLs. Create/edit a saved filter, for example:

```text
done = false && sourceBucketId in 10, 20, 30
```

These are example bucket IDs, not task IDs. Select the actual bucket IDs for
your installation. Select priority descending in its List view. In user settings,
choose that saved filter as the home-page filter if desired. The Overview now
also uses priority descending for its all-tasks section.

Moving tasks into/out of the referenced buckets changes matching results on the
next read; no external synchronizer or status tags are required. Creating or
replacing a board/bucket requires updating its ID in the filter. Only tasks the
requesting user can access are returned. Buckets in private saved-filter views
are deliberately excluded.

## Manual releases

The APT installation is a binary installation, not a Git checkout. `git pull`
alone cannot update it. Build frontend first (`pnpm install --frozen-lockfile`
then `pnpm build` inside `frontend/`), then backend (`mage build` at the root).
Requirements are declared in `go.mod` and `frontend/package.json`; do not use
the agent's private Node installation.

Install verified binaries to a separate versioned directory, and point the
existing service at that path through an administrator-managed systemd drop-in.
Keep the existing service user, config, state directory, credentials and reverse
proxy. Preserve `/opt/vikunja/vikunja` so APT does not overwrite custom binaries.

Before starting a new binary, stop the service and take a consistent backup of
all state, configuration and required restore credentials. Upstream changes can
contain migrations even when this fork's own changes do not. A binary rollback
after a schema upgrade may also require restoration of the matching data backup.

For later releases: review the target commit, pull with `--ff-only`, build and
test, snapshot data, install a new version, switch the service, verify API, UI
and MCP. Perform this manually. GitHub checks have no access to the VPS.

When serving this modified AGPL application, make the corresponding source of
the deployed revision available to users. Keep this repository and its source
revision identifiable in release records.

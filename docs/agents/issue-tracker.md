# Issue tracker: Local Markdown

本仓库不用 GitHub Issues。规格和任务写成 `docs/specs/` 下的 markdown 文件，随 git 提交，协作者 pull 后即可看到。

目的：告诉 skill「发布到 issue tracker」在本仓库是写文件，不调用 GitHub，避免改动远端。

## Conventions

- One feature per directory: `docs/specs/<feature-slug>/`
- The spec is `docs/specs/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `docs/specs/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- State is recorded as a `Status:` line near the top of each spec or issue file (see `triage-labels.md` for the status strings)
- Blocking is a `Blocked by: NN, NN` line near the top; a ticket is unblocked when every listed file has `Status: done`
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- When a ticket is finished, set `Status: done` in the same commit as the change

## When a skill says "publish to the issue tracker"

Create a new file under `docs/specs/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The developer will normally pass the path or the issue number directly.

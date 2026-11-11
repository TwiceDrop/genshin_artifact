# Status values

The skills speak in terms of canonical triage roles. In this repo a role is written as the `Status:` line of a file under `docs/specs/`, not as a GitHub label.

| Role in mattpocock/skills | `Status:` value | Meaning |
| ------------------------- | --------------- | ------- |
| `needs-triage`            | `needs-triage`    | A developer still needs to evaluate it |
| `needs-info`              | `needs-info`      | Waiting on more information |
| `ready-for-agent`         | `ready-for-agent` | Fully specified, an agent can implement it |
| `ready-for-human`         | `ready-for-human` | Needs a developer: design call, device testing or external access |
| `wontfix`                 | `wontfix`         | Will not be done |
| (local only)              | `done`            | Implemented and committed |

When a skill mentions a role (e.g. "apply the `ready-for-agent` triage label"), write the matching `Status:` value instead.

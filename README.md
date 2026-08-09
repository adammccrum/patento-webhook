# patento-webhook

LAO Academy + IrisKey.ai multi-agent system.

## Documentation

All documentation lives in a single consolidated document:

**[docs/LAO-MASTER-DOCUMENTATION.md](docs/LAO-MASTER-DOCUMENTATION.md)**

| Part | Contents |
|---|---|
| Orientation | Operating principles, deployment models |
| I | System architecture |
| II | Provider registry and inventory |
| III | Adapter specification |
| IV | Agent system (26 NATO agents, Alpha orchestrator) |
| V | Authorization and audit |
| VI | Implementation guide |
| VII | Quick start |
| VIII | Competitive engineering intelligence (research) |
| IX | **Reconciliation log — open defects** |

> ⚠️ **Read Part IX before writing code against Parts I–VII.** It catalogues conflicts between the previously separate specification documents, including two incompatible definitions of the base adapter class and several incorrect licence records. Part IX §4 also documents why the Quick Start does not currently run against this repository as committed.

Previously the documentation was split across nine files in `docs/`. They were consolidated on 2026-08-09; their full history remains in git.

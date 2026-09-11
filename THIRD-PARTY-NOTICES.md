# Third-party notices

This repository is released under the MIT License (see `LICENSE`). It also contains code adapted
from other MIT-licensed projects. Their copyright notices and permission text are reproduced here,
as the licence requires, and every adapted file carries a header naming its source.

## session-usage (panrafal/paseo-plugins)

Source: <https://github.com/panrafal/paseo-plugins/tree/8d33de5ff811096511c856795dfe0a7a41481338/session-usage>
(commit `8d33de5`).

The transcript parser, indexer, usage model, calendar model and the provider-comparison and
activity-calendar visualisations in this plugin are adapted from that project:

| In this repository | Adapted from |
| --- | --- |
| `apps/paseo/server/transcript-parser.ts` | `session-usage/server/parser.ts` |
| `apps/paseo/server/transcript-index.ts` | `session-usage/server/indexer.ts`, `session-usage/server/paseo-home.ts` |
| `apps/paseo/shared/usage-schema.ts` | `session-usage/shared/schema.ts` |
| `apps/paseo/shared/usage-pricing.ts` | `session-usage/shared/pricing.ts` |
| `apps/paseo/shared/usage-model.ts` | `session-usage/shared/model.ts`, `session-usage/shared/table.ts` |
| `apps/paseo/shared/usage-calendar.ts` | `session-usage/shared/calendar.ts` |
| `apps/paseo/client/usage.tsx` | `session-usage/client/charts.tsx`, `session-usage/client/activity-calendar.tsx`, parts of `session-usage/client/usage-surface.tsx` |
| `apps/paseo/tests/usage/parser.test.ts` | `session-usage/server/parser.test.ts` |
| `apps/paseo/tests/usage/indexer.test.ts` | `session-usage/server/indexer.test.ts` |
| `apps/paseo/tests/usage/model.test.ts` | `session-usage/server/model.test.ts` |

```
MIT License

Copyright (c) 2026 panrafal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

# BrowserPair examples

Small integration examples for [BrowserPair](https://browserpair.com/), connecting AI agents to the user's existing Chrome browser through scoped Remote MCP and REST.

## Choose a path

| Example | What it demonstrates |
| --- | --- |
| [REST starter](rest.mjs) | Discover browsers, create one bounded task, inspect state and cancel |
| [MCP connection recipe](#connect-an-mcp-client) | Connect your existing AI app and follow the durable task lifecycle |

These examples use the [published REST contract](https://docs.browserpair.com/rest-api). They are integration starters, not a full autonomous agent or an SDK.

## Prerequisites

- Pair the [Chrome extension](https://chromewebstore.google.com/detail/agdomhjeahcbelohnmjmbldeldclnoof) in the [BrowserPair app](https://app.browserpair.com/).
- Create an agent key scoped to the intended browser. Both permission modes allow every website/tool; initial domains describe the task, not a key allow list.
- Install Node.js 20 or later for the REST starter.

Keep the agent key in your local environment. Never commit it, put it in a URL or paste it into an Issue. Your browser-device credential is different from an agent key.

## REST starter

Clone this repository and run commands from its root. No package installation is needed.

Read the key locally without placing its value in shell history:

```bash
read -rsp 'BrowserPair agent key: ' BROWSERPAIR_AGENT_KEY
export BROWSERPAIR_AGENT_KEY
node rest.mjs list
```

Copy an authorized online browser ID from the response, then prepare a task:

```bash
export BROWSERPAIR_BROWSER_ID='replace-with-your-browser-id'
export BROWSERPAIR_IDEMPOTENCY_KEY="example-title-$(date +%s)"
node rest.mjs create --dry-run
node rest.mjs create
```

The create command only starts a bounded task to read example.com's title; it does not implement the subsequent agent action loop. It may consume a task credit. Use a fresh idempotency key for a new task; reuse the same key with the identical request if a creation response was lost.

Inspect or cancel using the task ID returned by the service:

```bash
export BROWSERPAIR_TASK_ID='replace-with-returned-task-id'
node rest.mjs state
node rest.mjs observe --dry-run
node rest.mjs observe
node rest.mjs state
node rest.mjs cancel
unset BROWSERPAIR_AGENT_KEY
```

State responses can include private page observations. Inspect them locally and redact before sharing.

The starter intentionally does not send arbitrary click or form actions. A full agent must use current observations, matching interaction generations, user approvals and effect resolution. See [REST](https://docs.browserpair.com/rest-api) and [task semantics](https://docs.browserpair.com/task-semantics).

## Connect an MCP client

Use the remote server URL:

```text
https://mcp.browserpair.com
```

For clients supporting BrowserPair's OAuth flow, add the server in that client's connector settings and review the consent screen. For agent-key clients, use a Bearer agent key as documented in the [MCP reference](https://docs.browserpair.com/remote-mcp). Client configuration formats differ; do not assume a universal JSON configuration.

The external agent should:

1. Discover an authorized online browser.
2. Start a task with a goal and initial domains; capability hints do not restrict tool access.
3. Read current task state and observations.
4. Perform or delegate a bounded next step.
5. Pause for required user input and resolve uncertain effects from fresh page evidence; never repeat uncertain steps automatically.
6. Verify the outcome, then finish or report blocked.

## Verification and limitations

The code is designed for dry-run inspection without a credential. Live behavior still depends on your account, key scope, browser connection and current service contract. A task being accepted is not evidence that its goal has completed.

Do not use these examples to bypass user approval or expand task authority. Contributions should be small, dependency-light and include reproducible verification steps.

[Product hub](https://github.com/BrowserPair/browserpair) · [Documentation](https://docs.browserpair.com/) · [Skills](https://github.com/BrowserPair/skills)

## MCP request shapes

Call `tools/list` first: OAuth apps receive named actions; agent keys receive lifecycle tools, WebMCP tools and `task_respond`. `task_user_step` is managed-model only. For example, the `tools/call` parameters to create a task are:

```json
{"name":"browser_run","arguments":{"browser_id":"brw_example","goal":"Read example.com's heading","allowed_domains":["example.com"],"idempotency_key":"example-heading-001","max_side_effects":0}}
```

Creation does not drive the page. Read `task_state` using `{"task_id":"tsk_example"}`, then use its current generation. OAuth navigation uses:

```json
{"name":"task_navigate","arguments":{"task_id":"tsk_example","interaction_generation":3,"url":"https://example.com"}}
```

An agent key uses the equivalent:

```json
{"name":"task_respond","arguments":{"task_id":"tsk_example","interaction_generation":3,"action":{"kind":"navigate","url":"https://example.com"}}}
```

Both surfaces can query delivered observations:

```json
{"name":"task_find","arguments":{"task_id":"tsk_example","interaction_generation":4,"query":"Example Domain"}}
```

```json
{"name":"task_extract","arguments":{"task_id":"tsk_example","interaction_generation":4}}
```

Generations above are illustrative; replace them with current state. Full-document interactive refs include offscreen controls (`in_viewport`). `task_find` searches captured full-page text; `task_extract` reads captured lists/tables. Reads are bounded and redacted; missing data is not proof of absence.

REST responses use `interactionGeneration`, and `/respond` takes `{"interactionGeneration":4,"action":{"kind":"done","summary":"Read heading","expectedOutcome":{"criteria":[{"kind":"text_contains","value":"Example Domain"}]}}}`. OAuth uses `task_done` with the same action fields plus `task_id` and `interaction_generation`; agent keys wrap `kind: done` in `task_respond`.

Reuse an explicit MCP `idempotency_key` only for identical creation retries; request IDs alone do not deduplicate tasks. Every task holds all capabilities. Standard asks only before payments/purchases, sign-in and account/security changes, deleting, sending/publishing, files and passwords/secrets. Developer adds no mode confirmations; immutable task confirmations, Chrome host access and manual inputs still apply. Resolve uncertain effects from fresh observations and never replay them.

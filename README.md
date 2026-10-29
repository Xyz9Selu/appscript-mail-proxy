# appscript-mail-proxy

Google Apps Script web app that proxies Gmail over HTTP.

## Setup

1. `npm install` (or use a global `clasp`), then `npx clasp login`.
2. `npm run push` uploads `src/` to the Apps Script project.
3. In the Apps Script editor: Project Settings → Script Properties → add `API_TOKEN`.
4. Run `doGet` once in the editor to grant Gmail access.
5. `npm run deploy` creates a web app deployment. The URL is `https://script.google.com/macros/s/<deploymentId>/exec`.

## Search mail

```
GET <exec-url>?token=<API_TOKEN>&query=is:unread from:foo@example.com&start=0&max=20&body=plain
```

| Param   | Default | Meaning |
|---------|---------|---------|
| `query` | `""`    | Gmail search syntax, passed to `GmailApp.search(query, start, max)` |
| `start` | `0`     | Index of the first thread |
| `max`   | `20`    | Number of threads, 1–500 |
| `body`  | `none`  | `none`, `plain` or `html` message bodies |
| `token` | —       | Must equal the `API_TOKEN` script property |

The response is JSON: `{ ok, query, start, max, count, threads: [{ id, subject, ..., messages: [...] }] }`.
On error: `{ ok: false, error }`. Apps Script web apps always return HTTP 200, so check `ok`.
Requests get a 302 redirect to `script.googleusercontent.com`; use `curl -L`.

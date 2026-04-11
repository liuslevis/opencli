# Baidu

**Mode**: Public / Browser | **Domain**: `baidu.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli baidu search <query>` | Search Baidu web results via browser-rendered DOM |
| `opencli baidu suggest <query>` | Get Baidu search suggestions |

## Usage Examples

```bash
# Search
opencli baidu search "OpenAI" --limit 20

# Collect deeper result sets automatically
opencli baidu search "OpenAI" --limit 100 -f json

# Suggest
opencli baidu suggest "OpenAI" --limit 5

# JSON output
opencli baidu suggest "OpenAI" -f json
```

## Notes

- This adapter uses Baidu's public suggestion endpoint.
- `baidu search` uses the browser-rendered page because direct public HTTP requests were hitting Baidu's security verification flow on 2026-03-22.
- `baidu search --limit` now pages through Baidu results in 10-result batches and supports up to 100 results.
- Deep searches can still stop early if Baidu stops exposing more result pages or shows a verification page. In that case, OpenCLI returns the results collected so far and prints a warning.
- If Baidu shows a verification page in Chrome too, open the query there once and retry the CLI command.

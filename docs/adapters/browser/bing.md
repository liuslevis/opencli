# Bing

**Mode**: Public / Browser | **Domain**: `bing.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli bing search <query>` | Search Bing web results via browser-rendered DOM |
| `opencli bing news <query>` | Search Bing News results via RSS |

## Usage Examples

```bash
# Web search
opencli bing search "OpenAI" --limit 20

# Collect deeper result sets automatically
opencli bing search "OpenAI" --limit 50 --market en-US -f json

# Bing News
opencli bing news "OpenAI" --limit 5

# Force a specific market
opencli bing search "OpenAI" --market en-US -f json
```

## Prerequisites

- `bing search` now needs a working browser bridge because RSS paging was not yielding real additional result pages in this environment on 2026-03-23.
- `bing news` still uses RSS and does not require a browser.
- `bing search --limit` auto-pages in 10-result batches and supports up to 100 results.
- Deep searches can still stop early if Bing blocks pagination or stops exposing a next-page link. In that case, OpenCLI returns the results collected so far and prints a warning.
- Some locale-specific `--market` values may not return RSS for `bing news`. If that happens, retry without `--market` or use `en-US`.

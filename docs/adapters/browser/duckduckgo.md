# DuckDuckGo

**Mode**: Public | **Domain**: `duckduckgo.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli duckduckgo suggest <query>` | Get DuckDuckGo autocomplete suggestions |

## Usage Examples

```bash
# Suggest
opencli duckduckgo suggest "OpenAI" --limit 5

# JSON output
opencli duckduckgo suggest "OpenAI" -f json
```

## Notes

- This adapter uses DuckDuckGo's public autocomplete endpoint.
- The HTML search endpoints were returning anomaly/bot challenge pages in this environment on 2026-03-21.
- The instant-answer JSON endpoint was returning an empty body to Node HTTP clients in this environment on 2026-03-21, so it is intentionally not exposed as a CLI command.

# Bing

**Mode**: Public | **Domain**: `bing.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli bing search <query>` | Search Bing web results via RSS |
| `opencli bing news <query>` | Search Bing News results via RSS |

## Usage Examples

```bash
# Web search
opencli bing search "OpenAI" --limit 5

# Bing News
opencli bing news "OpenAI" --limit 5

# Force a specific market
opencli bing search "OpenAI" --market en-US -f json
```

## Prerequisites

- No browser required; these commands use Bing RSS feeds.
- Some locale-specific `--market` values may not return RSS for `bing news`. If that happens, retry without `--market` or use `en-US`.

# Google

**Mode**: Public / Browser | **Domain**: `google.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli google search <query>` | Search Google web results via browser-rendered DOM |
| `opencli google news <query>` | Search Google News headlines via RSS |
| `opencli google suggest <query>` | Get Google autocomplete suggestions |

## Usage Examples

```bash
# Google Search
opencli google search "OpenAI" --limit 5

# Google News
opencli google news "OpenAI" --limit 5

# Google Suggest
opencli google suggest "OpenAI" --limit 5

# Switch locale/edition for Google News
opencli google news "OpenAI" --hl zh-CN --gl CN --ceid CN:zh-CN -f json
```

## Notes

- `google news` is backed by Google News RSS and is stable in this environment.
- `google search` uses the browser-rendered page because the public HTML endpoint was not stable enough for reliable direct HTTP parsing on 2026-03-22.
- `google search --limit` is currently capped at 20 results, and the adapter only parses the first rendered Google results page. If Google renders 10 organic results for a query, OpenCLI will also return 10.
- `google search` needs a working browser bridge and may ask you to open the query in Chrome once if Google shows an anti-bot interstitial.

# Customer Log Summary Feature

## Overview

The system now supports summarizing logs across all customers with status counts and health scores.

## Usage

### In Chatbot

Ask the chatbot:
```
summarize logs from all customers
```

Or variations:
```
show summary of all customers
summarize logs for all customers
get summary for all customers
```

### API Endpoint

```bash
curl "http://localhost:5000/monitor/mock/logs/summary"
```

## Response Format

### Overall Summary
- Total logs across all customers
- Total number of customers
- Overall health score (percentage)
- Status breakdown:
  - ✅ OK count
  - ⚠️ WARNING count
  - ❌ ERROR count
  - 🔴 CRITICAL count

### Per-Customer Breakdown
For each customer:
- Customer name
- Health score (percentage)
- Total logs
- Status counts (OK, WARNING, ERROR, CRITICAL)

Customers are sorted by health score (lowest first - most critical first).

## Health Score Calculation

Health score is calculated as:
1. **Base Score**: (OK logs / Total logs) × 100
2. **Penalties**:
   - CRITICAL: -20% per critical log
   - ERROR: -10% per error log
   - WARNING: -5% per warning log
3. **Final Score**: Base score - penalties (clamped between 0-100%)

### Health Score Indicators
- 🟢 **80-100%**: Healthy
- 🟡 **60-79%**: Warning
- 🟠 **40-59%**: Critical
- 🔴 **0-39%**: Critical

## Example Output

```
📊 **Log Summary for All Customers**

**Overall Statistics:**
- Total Logs: 10000
- Total Customers: 5
- **Overall Health Score: 85.5%**

**Status Breakdown:**
- ✅ OK: 8500
- ⚠️ WARNING: 1000
- ❌ ERROR: 400
- 🔴 CRITICAL: 100

**Customer Breakdown:**

1. 🟢 **Rocket Startup Labs**
   • Health Score: **92.5%**
   • Total Logs: 2000
   • ✅ OK: 1850 | ⚠️ WARNING: 100 | ❌ ERROR: 40 | 🔴 CRITICAL: 10

2. 🟡 **TechCore Solutions**
   • Health Score: **75.2%**
   • Total Logs: 2500
   • ✅ OK: 1880 | ⚠️ WARNING: 400 | ❌ ERROR: 180 | 🔴 CRITICAL: 40

...
```

## Integration

### Frontend
The summary is accessible via:
- Chatbot: Ask "summarize logs from all customers"
- API: `GET /monitor/mock/logs/summary`

### Backend
- Flask endpoint: `/monitor/mock/logs/summary`
- MCP tool: `summarizeAllLogs`
- Router: Automatically detects "summarize logs from all customers" queries

## Health Score Formula

```python
base_score = (OK_count / total_logs) * 100
critical_penalty = (CRITICAL_count / total_logs) * 20
error_penalty = (ERROR_count / total_logs) * 10
warning_penalty = (WARNING_count / total_logs) * 5

health_score = max(0, min(100, base_score - critical_penalty - error_penalty - warning_penalty))
```

## Testing

### Test Router
```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const r = await m.interpretMessage('summarize logs from all customers'); console.log(JSON.stringify(r, null, 2)); })"
```

Expected: `{"tool": "summarizeAllLogs", "args": {}}`

### Test Flask Endpoint
```bash
curl "http://localhost:5000/monitor/mock/logs/summary"
```

### Test Full Flow
1. Start Flask backend: `./START_FLASK.sh`
2. Start MCP server: `cd mcp-client && npm start`
3. Ask chatbot: "summarize logs from all customers"

## Troubleshooting

### "No logs found for any customers"
- Check if logs.json has logs with `customer_name` field
- Verify logs are uploaded to DynamoDB

### Health score is 0%
- Check if all logs have ERROR/CRITICAL status
- Verify log status values are correct (OK, WARNING, ERROR, CRITICAL)

### Router not detecting query
- Check router logs for detection
- Try variations: "summarize logs from all customers", "show summary of all customers"


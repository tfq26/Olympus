# LLM-Powered Log Summarization

## Overview

The log retrieval system now includes AI-powered summarization using NVIDIA's LLM to provide human-readable insights from system logs.

## How It Works

### Flow
1. **User requests logs**: "show recent logs from res_vm_001"
2. **Router detects query**: Routes to `getLogsByResource` tool
3. **Tool fetches logs**: Gets logs from DynamoDB via Flask backend
4. **AI Analysis**: Sends log samples to NVIDIA LLM for analysis
5. **Summary Generation**: LLM generates human-readable summary
6. **Response**: Returns summary + detailed logs to user

### AI Summary Includes

1. **Executive Summary**: Overall health status (2-3 sentences)
2. **Key Issues**: Critical or warning-level problems
3. **Patterns**: Notable trends or recurring issues
4. **Recommendations**: Actionable steps to improve system health

## Response Format

```
📊 **Log Report for Resource: res_vm_001**

**Statistics:**
- Total logs: 1000
- Status breakdown: **OK**: 15, **WARNING**: 3, **CRITICAL**: 2
- Displaying: 20 most recent logs

🤖 **AI Analysis Summary**
[LLM-generated human-readable summary with insights, issues, patterns, and recommendations]

---

**Recent Logs:**

1. ✅ **[OK]** 2025-11-07T22:30:00Z
   • Code: VM_1000 | Type: backup_status
   • Customer: ShopFast eCommerce

2. ⚠️ **[WARNING]** 2025-11-07T22:00:00Z
   • Code: VM_0997 | Type: backup_status
   • Customer: Rocket Startup Labs

...
```

## Features

### 1. Intelligent Analysis
- Analyzes log patterns and trends
- Identifies critical issues automatically
- Provides actionable recommendations

### 2. Human-Readable Format
- Clear, professional language
- Focus on what matters most
- Suitable for DevOps teams

### 3. Graceful Degradation
- If LLM fails, shows logs without summary
- Never blocks log retrieval
- Error handling for API failures

### 4. Context-Aware
- Uses most recent 15 logs for analysis
- Includes status breakdown
- Considers time ranges

## Configuration

### LLM Settings
- **Model**: `nvidia/nvidia-nemotron-nano-9b-v2`
- **Temperature**: 0.6 (balanced creativity/accuracy)
- **Max Tokens**: 2048
- **System Message**: "You are an experienced DevOps engineer analyzing system logs. Provide clear, actionable insights in a professional but accessible tone."

### Analysis Parameters
- **Sample Size**: 15 most recent logs
- **Context**: Status breakdown, time range, log types
- **Output**: Executive summary, key issues, patterns, recommendations

## Error Handling

### LLM API Failure
- Logs error to console
- Returns logs without summary
- User still gets full log data

### Timeout
- 30-second timeout for LLM calls
- Falls back to log display only
- Doesn't block log retrieval

## Performance

### Response Time
- **Without LLM**: ~100-500ms (log retrieval only)
- **With LLM**: ~2-5 seconds (includes AI analysis)
- **Optimization**: LLM analysis runs in parallel with log formatting

### Token Usage
- **Input**: ~500-1000 tokens (log samples + prompt)
- **Output**: ~200-500 tokens (summary)
- **Cost**: Minimal (NVIDIA API pricing)

## Usage Examples

### Basic Query
```
show recent logs from res_vm_001
```
**Result**: Summary + 20 most recent logs

### With Limit
```
show first 50 logs from res_vm_001
```
**Result**: Summary + 50 most recent logs

### Resource Name
```
show recent logs from ecs2
```
**Result**: Summary + logs (resource name resolved to ID)

## Benefits

1. **Faster Decision Making**: Quick insights without reading all logs
2. **Issue Detection**: Automatically identifies critical problems
3. **Pattern Recognition**: Spots trends humans might miss
4. **Actionable Insights**: Provides recommendations, not just data
5. **Professional Format**: Suitable for reports and documentation

## Future Enhancements

1. **Customizable Summaries**: Different summary styles (brief, detailed, technical)
2. **Historical Comparison**: Compare current logs with previous periods
3. **Alert Generation**: Auto-generate alerts for critical issues
4. **Dashboard Integration**: Display summaries in monitoring dashboards
5. **Multi-Resource Analysis**: Analyze logs across multiple resources

## Troubleshooting

### No Summary Appearing
- Check NVIDIA API key is set: `MODEL_API_KEY` in `.env`
- Check MCP server logs for LLM errors
- Verify API quota/limits

### Summary Too Generic
- Increase sample size (currently 15 logs)
- Adjust temperature (higher = more creative)
- Modify system message for different tone

### Summary Missing Key Issues
- Ensure critical logs are in the sample
- Check if logs have proper status fields
- Verify message/description fields are populated


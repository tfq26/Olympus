# Example Prompts for Log Summaries

This document provides example prompts you can use to query log summaries with various filters.

## Basic Summary Queries

### All Customers
```
summarize logs from all customers
show summary of all customers
get summary for all customers
summarize logs for all customers
```

## Filter by Customer

### Specific Customer
```
summarize logs for Rocket Startup Labs
show summary for TechCore Solutions
get summary for DataFlow Technologies
summarize logs from ShopFast eCommerce
show summary of CloudMart Wholesale
```

### Partial Customer Name
```
summarize logs for Rocket
show summary for TechCore
get summary for DataFlow
summarize logs from ShopFast
```

## Filter by Status

### All Status Types
```
summarize OK logs
show summary of WARNING logs
get summary for ERROR logs
summarize CRITICAL logs
show summary of all ERROR logs
```

### Status for All Customers
```
summarize ERROR logs from all customers
show summary of CRITICAL logs for all customers
get summary of WARNING logs
summarize OK logs from all customers
```

## Combined Filters

### Customer + Status
```
summarize ERROR logs for Rocket Startup Labs
show summary of CRITICAL logs for TechCore Solutions
get summary of WARNING logs for DataFlow Technologies
summarize OK logs for ShopFast eCommerce
show summary of ERROR logs from CloudMart Wholesale
```

### Customer + Multiple Status
```
summarize ERROR and CRITICAL logs for Rocket Startup Labs
show summary of WARNING and ERROR logs for TechCore Solutions
get summary of CRITICAL logs for DataFlow Technologies
```

## Filter by Resource

### Resource ID
```
summarize logs for res_vm_001
show summary for resource res_vm_001
get summary of logs from res_vm_001
summarize logs from res_vm_002
```

### Resource + Status
```
summarize ERROR logs for res_vm_001
show summary of CRITICAL logs from res_vm_001
get summary of WARNING logs for res_vm_001
```

### Resource + Customer
```
summarize logs for res_vm_001 from Rocket Startup Labs
show summary for res_vm_001 for TechCore Solutions
```

## Complex Queries

### Multiple Filters
```
summarize ERROR logs for Rocket Startup Labs from res_vm_001
show summary of CRITICAL logs for TechCore Solutions
get summary of WARNING and ERROR logs for DataFlow Technologies
summarize OK logs for all customers except Rocket Startup Labs
```

## Alternative Phrasings

### Using "show"
```
show summary of all customers
show summary for Rocket Startup Labs
show ERROR logs summary
show summary of CRITICAL logs for TechCore Solutions
```

### Using "get"
```
get summary for all customers
get summary of logs for Rocket Startup Labs
get ERROR logs summary
get summary of CRITICAL logs
```

### Using "display"
```
display summary of all customers
display summary for Rocket Startup Labs
display ERROR logs summary
```

### Using "view"
```
view summary of all customers
view summary for Rocket Startup Labs
view ERROR logs summary
```

## Status Variations

### ERROR
- "ERROR logs"
- "error logs"
- "errors"
- "failed logs"
- "failure logs"

### CRITICAL
- "CRITICAL logs"
- "critical logs"
- "severe logs"
- "urgent logs"

### WARNING
- "WARNING logs"
- "warning logs"
- "warnings"

### OK
- "OK logs"
- "ok logs"
- "success logs"
- "healthy logs"

## Customer Names (Exact)

1. **Rocket Startup Labs**
2. **TechCore Solutions**
3. **DataFlow Technologies**
4. **ShopFast eCommerce**
5. **CloudMart Wholesale**

## Status Types

- **OK** - Successful operations
- **WARNING** - Warning conditions
- **ERROR** - Error conditions
- **CRITICAL** - Critical conditions

## Expected Output Format

All summary queries will return:

```
**Overall Statistics:**

- Total Logs: <number>
- Total Customers: <number>
- **Overall Health Score: <percentage>%**

**Status Breakdown:**

- ✅ OK: <number>
- ⚠️ WARNING: <number>
- ❌ ERROR: <number>
- 🔴 CRITICAL: <number>
```

If filters are applied, the output will show:
```
*Filters: customer_name: <name>, status: <status>*

**Overall Statistics:**
...
```

## Tips

1. **Case-insensitive**: Customer names and statuses are case-insensitive
2. **Partial matching**: Customer names can be partially matched (e.g., "Rocket" matches "Rocket Startup Labs")
3. **Multiple filters**: You can combine customer, status, and resource filters
4. **Natural language**: Use natural language - the system will extract the relevant filters
5. **All customers**: Use "all customers" to get summaries across all customers

## Examples with Expected Results

### Example 1: All Customers
**Query:** `summarize logs from all customers`

**Expected:** Summary of all 10,000 logs across all 5 customers

### Example 2: Specific Customer
**Query:** `show summary for Rocket Startup Labs`

**Expected:** Summary of logs only for Rocket Startup Labs

### Example 3: Status Filter
**Query:** `summarize ERROR logs`

**Expected:** Summary of all ERROR logs across all customers

### Example 4: Combined Filter
**Query:** `summarize ERROR logs for Rocket Startup Labs`

**Expected:** Summary of ERROR logs only for Rocket Startup Labs

### Example 5: Resource Filter
**Query:** `summarize logs for res_vm_001`

**Expected:** Summary of all logs for resource res_vm_001

## Troubleshooting

If you get "No logs found":
1. Check the customer name spelling
2. Verify the status is one of: OK, WARNING, ERROR, CRITICAL
3. Check the resource ID format (should start with "res_")
4. Try a more general query first (e.g., "summarize logs from all customers")

If filters aren't working:
1. Use exact customer names from the list above
2. Use exact status names: OK, WARNING, ERROR, CRITICAL
3. Try simpler queries first, then add filters


# SQLite Input/Output Documentation

## Overview
This document describes the complete input and output format for SQLite queries in the AlgoCore Code Runner.

## API Endpoint
```
POST /run
Content-Type: application/json
```

## Input Format

### Request Body Structure
```json
{
  "language": "sqlite" | "sql",
  "sourceCode": "<SQL_COMMANDS>",
  "input": "<ADDITIONAL_SQL_COMMANDS>" // Optional
}
```

### Input Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | string | Yes | Must be "sqlite" or "sql" |
| `sourceCode` | string | Yes | Main SQL commands to execute |
| `input` | string | No | Additional SQL commands (appended to sourceCode) |

### Supported SQL Commands

#### 1. DDL (Data Definition Language)
```sql
-- Create tables
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    age INTEGER,
    email TEXT
);

-- Drop tables
DROP TABLE users;

-- Alter tables
ALTER TABLE users ADD COLUMN phone TEXT;
```

#### 2. DML (Data Manipulation Language)
```sql
-- Insert data
INSERT INTO users (name, age, email) 
VALUES ('Alice', 25, 'alice@example.com');

-- Insert multiple rows
INSERT INTO users (name, age, email) VALUES 
    ('Bob', 30, 'bob@example.com'),
    ('Charlie', 35, 'charlie@example.com');

-- Update data
UPDATE users SET age = 26 WHERE name = 'Alice';

-- Delete data
DELETE FROM users WHERE age > 30;
```

#### 3. DQL (Data Query Language)
```sql
-- Select all
SELECT * FROM users;

-- Select specific columns
SELECT name, email FROM users;

-- With conditions
SELECT * FROM users WHERE age > 25;

-- With ordering
SELECT * FROM users ORDER BY age DESC;

-- With limits
SELECT * FROM users LIMIT 10;

-- Complex queries
SELECT u.name, u.age, COUNT(*) as order_count 
FROM users u 
JOIN orders o ON u.id = o.user_id 
WHERE u.age > 25 
GROUP BY u.id 
ORDER BY order_count DESC;
```

## Output Format

### Response Structure
```json
{
  "output": "<JSON_ARRAY>",
  "error": "<ERROR_MESSAGE>" | null,
  "exitCode": 0 | 1,
  "cpuTime": <MILLISECONDS>,
  "memory": 2048,
  "timeout": false | true,
  "signal": "<SIGNAL_NAME>" | null,
  "compileTime": null
}
```

### Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | JSON array string containing query results |
| `error` | string \| null | Error message if execution failed |
| `exitCode` | number | 0 for success, 1 for error |
| `cpuTime` | number | Execution time in milliseconds |
| `memory` | number | Memory usage (always 2048) |
| `timeout` | boolean | True if execution timed out (>10s) |
| `signal` | string \| null | Process termination signal |
| `compileTime` | null | Always null for SQLite |

### Query Results Format

The `output` field contains a JSON array where:
- Each object represents a row
- Object keys are column names (headers)
- Object values are the cell values

#### Example 1: Simple Query
**Input:**
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
INSERT INTO users (name, age) VALUES ('Alice', 25), ('Bob', 30);
SELECT * FROM users;
```

**Output:**
```json
{
  "output": "[{\"id\":1,\"name\":\"Alice\",\"age\":25},{\"id\":2,\"name\":\"Bob\",\"age\":30}]",
  "error": null,
  "exitCode": 0,
  "cpuTime": 45,
  "memory": 2048,
  "timeout": false,
  "signal": null,
  "compileTime": null
}
```

#### Example 2: Complex Query
**Input:**
```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT,
    price REAL,
    category TEXT
);
INSERT INTO products VALUES 
    (1, 'Laptop', 999.99, 'Electronics'),
    (2, 'Mouse', 29.99, 'Electronics'),
    (3, 'Book', 19.99, 'Education');

SELECT category, COUNT(*) as count, AVG(price) as avg_price 
FROM products 
GROUP BY category;
```

**Output:**
```json
{
  "output": "[{\"category\":\"Electronics\",\"count\":2,\"avg_price\":514.99},{\"category\":\"Education\",\"count\":1,\"avg_price\":19.99}]",
  "error": null,
  "exitCode": 0,
  "cpuTime": 67,
  "memory": 2048,
  "timeout": false,
  "signal": null,
  "compileTime": null
}
```

#### Example 3: Error Response
**Input:**
```sql
SELECT * FROM non_existent_table;
```

**Output:**
```json
{
  "output": "",
  "error": "no such table: non_existent_table",
  "exitCode": 1,
  "cpuTime": 12,
  "memory": 2048,
  "timeout": false,
  "signal": null,
  "compileTime": null
}
```

## SQLite Configuration

The server uses SQLite with the following configuration:
- **Headers**: Enabled (`.headers on`)
- **Output Mode**: JSON (`.mode json`)
- **Database File**: Temporary `main.db` in execution directory
- **Timeout**: 10 seconds
- **File System**: Temporary directory created per execution

## Data Types

SQLite supports the following data types that will be reflected in JSON output:

| SQLite Type | JSON Representation | Example |
|-------------|-------------------|---------|
| INTEGER | number | `25` |
| TEXT | string | `"Alice"` |
| REAL | number | `25.5` |
| BLOB | string (base64) | `"AQIDBA=="` |
| NULL | null | `null` |

## Best Practices

1. **Use semicolons** to separate multiple SQL statements
2. **Keep queries simple** - complex joins may timeout after 10 seconds
3. **Handle NULL values** - they will appear as `null` in JSON
4. **Use proper data types** - SQLite is dynamically typed but JSON output reflects the stored type
5. **Error handling** - always check the `error` field before processing `output`

## Limitations

- **Execution timeout**: 10 seconds
- **No persistent database**: Each execution creates a fresh database
- **Memory limit**: Fixed at 2048MB (not actively enforced)
- **No external files**: Cannot access external SQLite files
- **No extensions**: SQLite extensions are not available

## Example Usage

### cURL
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "language": "sqlite",
    "sourceCode": "CREATE TABLE test (id INTEGER, name TEXT); INSERT INTO test VALUES (1, \"Hello\"); SELECT * FROM test;"
  }'
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    language: 'sqlite',
    sourceCode: 'SELECT * FROM users WHERE age > 25;'
  })
});

const result = await response.json();
if (result.error) {
  console.error('SQL Error:', result.error);
} else {
  const rows = JSON.parse(result.output);
  console.log('Query Results:', rows);
}
```

### Python
```python
import requests
import json

response = requests.post('http://localhost:3000/run', json={
    'language': 'sqlite',
    'sourceCode': 'SELECT * FROM products WHERE price < 100;'
})

result = response.json()
if result['error']:
    print(f"SQL Error: {result['error']}")
else:
    rows = json.loads(result['output'])
    print("Query Results:", rows)
```

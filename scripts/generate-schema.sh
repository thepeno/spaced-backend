#!/bin/bash

# Create the output directory if it doesn't exist
mkdir -p test/integration

# Start the TypeScript file with export declaration
echo "export const schemaString = \`" > test/integration/sql.ts

# Find all .sql files in drizzle directory, sort them, and process each one
find drizzle -name "*.sql" -type f | sort | while read -r file; do
    # Append the file content, escaping any backticks
    cat "$file" | sed 's/`/\\`/g' >> test/integration/sql.ts
    # Add a semicolon and newline after each file
    echo ";" >> test/integration/sql.ts
done

# Close the template literal
echo "\`;" >> test/integration/sql.ts

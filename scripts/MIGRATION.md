# Steps for migrating from Spaced

Note: these steps are just for myself to set up the local environment.

0. Login to Turso CLI and Wrangler CLI.

1. Dump Turso to local.

    ```shell
    turso db shell spaced-prod-initial .dump > dump.sql
    ```

2. Create a new SQLite database based on the Turso dump.

    ```shell
    sqlite3 local/spaced-prod.db < dump.sql
    rm dump.sql
    ```

3. Update the `.env.old.example` file and rename it to `.env.old`.

4. Run the `transform.ts` script to transform the database data into *operations* to be executed by the new backend.

    ```shell
    tsx scripts/transform.ts
    ```

5. Run the `seed.ts` script to generate a `seed.sql` file to seed the database with the new operations.

    ```shell
    tsx scripts/seed.ts
    ```

6. Execute the `seed.sql` file to seed the database.

   ```shell
    pnpm dlx wrangler d1 execute spaced-backend-dev-test --local --file=./local/seed.sql

    ⛅️ wrangler 3.107.3
    --------------------

    🌀 Executing on local database spaced-backend-dev-test (79fb20e7-a5f3-43da-9c27-8e781b5a3beb) from .wrangler/state/v3/d1:
    🌀 To execute on your remote database, add a --remote flag to your wrangler command.
    🚣 35274 commands executed successfully.
    Waiting for the debugger to disconnect...
    Waiting for the debugger to disconnect...
    Waiting for the debugger to disconnect...
    ```

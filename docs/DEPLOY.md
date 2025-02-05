# Deploying the Backend

0. Login to Wrangler CLI.

1. Run `npx wrangler d1 create spaced-backend` to create the database.
   Copy the database ID and replace the one in `wrangler.json`.

2. Execute the schema against the database.

   ```shell
   pnpm run schema:remote
   ```

3. Generate a random string for the cookie secret and copy it into the secrets in the Cloudflare dashboard for the worker.

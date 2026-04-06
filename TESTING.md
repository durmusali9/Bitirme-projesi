Testing notes — how to run tests added in the repo

1) Install dev dependencies

   npm install

2) Recommended local DB

   If you can't reach Atlas (DNS/SRV issues), set a local fallback in .env:

   MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/langtalk-test

3) Run the existing test suite (health + endpoint checks)

   node server-test.js

4) Run the socket auth test (requires socket.io-client dev dep)

   node socket-test.js

   The script will: start a temporary server, attach a socket.io server using the same socketAuth middleware, register and log in a temporary user (skips if DB unavailable), then connect a socket.io-client using the returned token and assert the welcome payload.

5) Run the E2E UI test (Playwright)

   npm run test:e2e

   NOTE: Playwright installs browser engines. If you added Playwright, run `npx playwright install` once before running the test.

6) Combine everything

   npm run test:all

8) Admin flow test (PowerShell-friendly instructions)

    - Ensure `ADMIN_SECRET` is set in `.env`. Example `.env` (development only):

       NODE_ENV=development
       ADMIN_SECRET=admin_local_test_please_change
       # optionally use a local MongoDB for reliable local testing:
       MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/langtalk-test

    - Start the server (PowerShell):

```powershell
# install deps (once)
npm install

# start in production mode
npm run start

# or in development (auto-restart on change)
npm run dev
```

    - In a separate PowerShell terminal, run the admin flow test:

```powershell
# if you didn't set ADMIN_SECRET in .env, you can set it for this session only:
$env:ADMIN_SECRET='admin_local_test_please_change'

# run the admin flow test script
npm run test:admin

# or run directly with node
node test_admin_flow.js
```

    - What the admin flow test does:
       - Verifies server health, logs in using `ADMIN_SECRET`, creates a temporary user via `/api/auth/register`, lists users via `/api/admin/users`, deletes the test user, and logs out.

    - Notes:
       - If you rely on MongoDB Atlas and see DNS/SRV errors, set `MONGODB_URI_LOCAL` in `.env` to a local MongoDB instance as shown above.
       - The script expects `ADMIN_SECRET` to be present (from `.env` or session env).

7) Troubleshooting

- If you see DNS/ENOTFOUND errors when connecting to Atlas, ensure your DEV machine has internet DNS access (some corporate networks block SRV) or use a local MongoDB instance by setting MONGODB_URI_LOCAL in .env.
- If Playwright tests fail due to missing browser binaries, run: npx playwright install

---
If you'd like, I can run `npm install` for you and run the tests here — but your Windows PowerShell environment previously blocked use of `npm` due to execution policies. I can still add a short PowerShell-friendly command snippet to import Node/npm into the path or to run `npm` using `node -e` as a workaround — tell me if you'd like me to attempt that in this environment.
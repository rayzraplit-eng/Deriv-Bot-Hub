/**
 * OAuth routes:
 *
 * POST /oauth/exchange  — Deriv PKCE flow: exchange auth code for access_token,
 *                         then fetch all linked account tokens via WebSocket.
 *
 * POST /oauth/tokens    — Deriv implicit flow: accept acct/token pairs that
 *                         Deriv redirected directly in the callback URL params
 *                         (?acct1=CR123&token1=xxx…). Stores/updates each account.
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import { fetchDerivAccountInfo, fetchDerivAccountsFromOAuth, DerivAuthError } from "../lib/deriv";

const router: IRouter = Router();

const DERIV_APP_ID   = process.env.DERIV_APP_ID ?? "36544";
const TOKEN_ENDPOINT = "https://oauth.deriv.com/oauth2/token";

// ── Shared helper: persist a list of {loginid, token} pairs ──────────────────

async function saveAccounts(
  accounts: Array<{ loginid: string; token: string }>,
  log: { warn(obj: object, msg: string): void },
): Promise<number> {
  const existingRows = await db.select().from(accountsTable);
  const isFirstBatch = existingRows.length === 0;
  let savedCount = 0;

  for (const { loginid, token } of accounts) {
    let info;
    try {
      info = await fetchDerivAccountInfo(token);
    } catch (err) {
      log.warn({ err, loginid }, "Could not fetch account info — skipping");
      continue;
    }

    const [existing] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.loginid, loginid));

    if (existing) {
      await db
        .update(accountsTable)
        .set({ apiToken: token, balance: info.balance, currency: info.currency })
        .where(eq(accountsTable.loginid, loginid));
    } else {
      await db.insert(accountsTable).values({
        label:       loginid,
        apiToken:    token,
        loginid:     info.loginid,
        accountType: info.accountType,
        currency:    info.currency,
        balance:     info.balance,
        email:       info.email,
        country:     info.country,
        isActive:    isFirstBatch && savedCount === 0,
      });
    }

    savedCount++;
  }

  return savedCount;
}

router.post("/oauth/exchange", async (req, res): Promise<void> => {
  const { code, codeVerifier, redirectUri } = req.body as Record<string, unknown>;

  if (typeof code !== "string" || !code ||
      typeof codeVerifier !== "string" || !codeVerifier ||
      typeof redirectUri !== "string" || !redirectUri) {
    res.status(400).json({ error: "Missing required fields: code, codeVerifier, redirectUri" });
    return;
  }

  // ── 1. Exchange PKCE code for access_token ─────────────────────────────────
  let accessToken: string;
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        code_verifier: codeVerifier,
        client_id:     DERIV_APP_ID,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      req.log.warn({ status: tokenRes.status, body }, "Deriv token endpoint error");
      res.status(400).json({ error: `Deriv token exchange failed (${tokenRes.status}): ${body}` });
      return;
    }

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenData.access_token) {
      const msg = tokenData.error_description ?? tokenData.error ?? "No access_token in Deriv response";
      res.status(400).json({ error: msg });
      return;
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    req.log.error({ err }, "Failed to call Deriv token endpoint");
    res.status(502).json({ error: "Could not reach Deriv token endpoint" });
    return;
  }

  // ── 2. Authorise via WebSocket → get all linked account tokens ─────────────
  let accounts: Array<{ loginid: string; token: string }>;
  try {
    accounts = await fetchDerivAccountsFromOAuth(accessToken);
  } catch (err) {
    const message = err instanceof DerivAuthError ? err.message : "Failed to fetch accounts from Deriv";
    req.log.warn({ err }, "Deriv OAuth account fetch failed");
    res.status(400).json({ error: message });
    return;
  }

  if (accounts.length === 0) {
    res.status(400).json({ error: "No accounts returned by Deriv" });
    return;
  }

  // ── 3. Persist accounts ────────────────────────────────────────────────────
  const savedCount = await saveAccounts(accounts, req.log);
  res.json({ count: savedCount });
});

// ── POST /oauth/tokens — Deriv old implicit flow ──────────────────────────────
//
// Called by the frontend callback when Deriv redirects with:
//   ?acct1=CR123&token1=xxx&acct2=VRTC456&token2=yyy…
// instead of the newer ?code= PKCE format.

router.post("/oauth/tokens", async (req, res): Promise<void> => {
  const { accounts } = req.body as Record<string, unknown>;

  if (
    !Array.isArray(accounts) ||
    accounts.length === 0 ||
    accounts.some(
      (a) =>
        typeof a !== "object" ||
        a === null ||
        typeof (a as Record<string, unknown>).loginid !== "string" ||
        typeof (a as Record<string, unknown>).token !== "string",
    )
  ) {
    res.status(400).json({
      error: "Body must be { accounts: [{ loginid: string; token: string }] }",
    });
    return;
  }

  const typedAccounts = (accounts as Array<{ loginid: string; token: string }>).filter(
    ({ loginid, token }) => loginid && token,
  );

  if (typedAccounts.length === 0) {
    res.status(400).json({ error: "No valid accounts provided" });
    return;
  }

  const savedCount = await saveAccounts(typedAccounts, req.log);
  res.json({ count: savedCount });
});

export default router;

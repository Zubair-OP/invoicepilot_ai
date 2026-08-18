import { User } from "../../database/models/index.js";
import { env } from "../../config/env.js";
import { ServiceUnavailableError, NotFoundError, UnauthorizedError } from "../../common/errors/index.js";
import { logger } from "../../observability/logger.js";
import crypto from "node:crypto";

const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

function signState(userId: string, timestamp: number): string {
  return crypto
    .createHmac("sha256", env.CLERK_SECRET_KEY)
    .update(`${userId}.${timestamp}`)
    .digest("base64url");
}

function encodeState(userId: string): string {
  const timestamp = Date.now();
  const signature = signState(userId, timestamp);
  return Buffer.from(JSON.stringify({ userId, timestamp, signature }), "utf8").toString("base64url");
}

function decodeState(state: string): string {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      userId?: string;
      timestamp?: number;
      signature?: string;
    };

    if (!parsed.userId || !parsed.timestamp || !parsed.signature) {
      throw new UnauthorizedError("Invalid Google OAuth state");
    }

    if (Date.now() - parsed.timestamp > GOOGLE_STATE_TTL_MS) {
      throw new UnauthorizedError("Expired Google OAuth state");
    }

    const expected = signState(parsed.userId, parsed.timestamp);
    const actual = Buffer.from(parsed.signature);
    const expectedBuffer = Buffer.from(expected);
    if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
      throw new UnauthorizedError("Invalid Google OAuth state");
    }

    return parsed.userId;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError("Invalid Google OAuth state");
  }
}

/**
 * Generates the Google OAuth 2.0 authorization URL for 1-click Gmail connection.
 */
export function getAuthUrl(userId: string): { url: string } {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new ServiceUnavailableError(
      "Google OAuth is not configured on the server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend .env file."
    );
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: encodeState(userId),
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

/**
 * Exchanges the Google authorization code for access and refresh tokens.
 */
export async function handleCallback(code: string, state: string): Promise<string> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new ServiceUnavailableError("Google OAuth credentials are not configured");
  }

  const userId = decodeState(state);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
    logger.error({ err: tokenData }, "Google OAuth token exchange failed");
    throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange Google OAuth code");
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const profileData = (await profileResponse.json()) as { email?: string; name?: string };

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");

  user.googleAccount = {
    connected: true,
    email: profileData.email,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || user.googleAccount?.refreshToken,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
    connectedAt: new Date(),
  };

  if (!user.settings.businessEmail && profileData.email) {
    user.settings.businessEmail = profileData.email;
  }

  await user.save();
  logger.info({ userId, googleEmail: profileData.email }, "Google account connected successfully for Gmail sending");

  return profileData.email || "Google Account";
}

/**
 * Disconnects the user's Google account.
 */
export async function disconnect(userId: string): Promise<void> {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");

  user.googleAccount = {
    connected: false,
    email: undefined,
    accessToken: undefined,
    refreshToken: undefined,
    expiresAt: undefined,
    connectedAt: undefined,
  };

  await user.save();
  logger.info({ userId }, "Google account disconnected");
}

/**
 * Retrieves the user's current Google integration status.
 */
export async function getStatus(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  email?: string;
  connectedAt?: Date;
}> {
  const isConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("googleAccount")
    .lean();

  return {
    configured: isConfigured,
    connected: Boolean(user?.googleAccount?.connected),
    email: user?.googleAccount?.email,
    connectedAt: user?.googleAccount?.connectedAt,
  };
}

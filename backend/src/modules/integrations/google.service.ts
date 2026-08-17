import { User } from "../../database/models/index.js";
import { env } from "../../config/env.js";
import { ServiceUnavailableError, NotFoundError } from "../../common/errors/index.js";
import { logger } from "../../observability/logger.js";

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
    state: userId,
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

/**
 * Exchanges the Google authorization code for access and refresh tokens.
 */
export async function handleCallback(code: string, userId: string): Promise<string> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new ServiceUnavailableError("Google OAuth credentials are not configured");
  }

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

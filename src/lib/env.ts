// Centralised access to environment variables with clear errors.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  vapidPublicKey: () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

/**
 * AUTH_EMAIL_CONFIRMATION=off creates accounts already confirmed, so sign-up
 * sends no email. Meant for when the mail sender cannot reach new addresses
 * (e.g. Resend without a verified domain). Anything else keeps confirmation on.
 */
export function emailConfirmationEnabled(value = process.env.AUTH_EMAIL_CONFIRMATION): boolean {
  return value?.trim().toLowerCase() !== "off";
}

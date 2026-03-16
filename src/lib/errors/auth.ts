export function mapAuthError(message?: string): string {
  if (!message) return "We couldn\u2019t sign you in. Please try again.";
  const msg = message.toLowerCase();

  if (msg.includes("invalid login") || msg.includes("invalid email or password")) {
    return "Email or password is incorrect.";
  }
  if (msg.includes("user not found") || msg.includes("invalid email")) {
    return "No account found with this email.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (msg.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return "We couldn\u2019t sign you in. Please check your details and try again.";
}


const ALLOWED_DOMAINS = ['gehu.ac.in', 'geu.ac.in'] as const;

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  college?: string;
}

/**
 * Validates college email format: studentname.studentid@collegename.ac.in
 * Allowed domains: gehu.ac.in, geu.ac.in
 * Non-digit studentid values are permitted.
 */
export function validateCollegeEmail(rawEmail: string): EmailValidationResult {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return { valid: false };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Enter a valid email address.' };
  }

  const [localPart, domain] = parts;

  if (!ALLOWED_DOMAINS.includes(domain as (typeof ALLOWED_DOMAINS)[number])) {
    return {
      valid: false,
      reason: 'Use your @gehu.ac.in or @geu.ac.in college email.',
    };
  }

  // Must follow studentname.studentid (at least two non-empty dot-separated segments)
  const localSegments = localPart.split('.').filter(Boolean);
  if (localSegments.length < 2 || !/^[a-z0-9._-]+$/.test(localPart)) {
    return {
      valid: false,
      reason: 'Format should be studentname.studentid@' + domain,
    };
  }

  return {
    valid: true,
    college: domain.split('.')[0].toUpperCase(),
  };
}

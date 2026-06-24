type AuthMode = "login" | "signup";

export const AUTH_MOBILE_PROCESS_STEPS = [
  { key: "generate", label: "Generate" },
  { key: "approve", label: "Approve" },
  { key: "launch", label: "Launch" },
] as const;

export const AUTH_MOBILE_COPY = {
  signup: {
    heroLine1: "Let's get your first",
    heroLine2: "qualified conversation.",
    subtext:
      "Create your account and we'll guide you through the setup in just a few minutes.",
    submitLabel: "Continue",
    alternatePrompt: "Do you have an account?",
    alternateLink: "Login",
    alternateHref: "/login",
    showTerms: true,
    showFullName: true,
  },
  login: {
    heroLine1: "Welcome back to your",
    heroLine2: "qualified conversations.",
    subtext:
      "Sign in and we'll pick up right where you left off in just a few minutes.",
    submitLabel: "Continue",
    alternatePrompt: "Don't have an account?",
    alternateLink: "Sign up",
    alternateHref: "/signup",
    showTerms: false,
    showFullName: false,
  },
} as const satisfies Record<
  AuthMode,
  {
    heroLine1: string;
    heroLine2: string;
    subtext: string;
    submitLabel: string;
    alternatePrompt: string;
    alternateLink: string;
    alternateHref: string;
    showTerms: boolean;
    showFullName: boolean;
  }
>;

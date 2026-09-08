export const DEMO_STRATEGY = Object.freeze({
  company: "Sample growth company",
  market: "North American B2B software teams",
  audience: "Founders and revenue leaders at teams of 10–200 people",
  valueProposition: "Book more qualified conversations without adding manual prospecting work.",
  roles: ["Founder", "VP of Sales", "Head of Growth"],
  angles: [
    {
      title: "Remove manual prospecting",
      description: "Lead with the time their team gets back each week.",
      opener: "Hi {{FirstName}}, your team can reach the right buyers without building another manual process at {{Company}}.",
    },
    {
      title: "Increase reply quality",
      description: "Show how research-led personalization creates more relevant conversations.",
      opener: "Hi {{FirstName}}, we found a practical way for {{Company}} to make every first touch more relevant.",
    },
  ],
  channels: ["LinkedIn", "Email"],
});

export const DEMO_API_CREDENTIAL = "lr_demo_••••••••demo";
export const DEMO_API_BASE_URL = "https://api.demo.leadreacher.example/v1";

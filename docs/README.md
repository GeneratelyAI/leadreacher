# LeadReacher Documentation

This directory is the source of truth for product flow, operational runbooks,
and system-design decisions. It documents the current implementation first and
marks planned behavior explicitly.

## Product areas

- [Product vision and lifecycle](product/product-vision.md)
- [Onboarding](onboarding/README.md)
- [Dashboard](dashboard/README.md)

## Implementing with an AI agent

Start with the [AI implementation guide](IMPLEMENTATION_GUIDE.md), then read
the product-area implementation map before editing:

- [Onboarding implementation map](onboarding/implementation-map.md)
- [Dashboard implementation map](dashboard/implementation-map.md)

## Technical reference

- [System architecture](architecture/system-design.md)
- [Credential storage and provider custody](architecture/security-credential-storage.md)
- [Billing and onboarding environment setup](operations/onboarding-billing-setup.md)
- [Unipile and LinkedIn connection testing](operations/unipile-connection-testing.md)
- [Video pipeline live E2E documentation](video/README.md)

## Documentation conventions

- **Implemented** means the behavior is present in the application today.
- **Planned** means it is a product direction, not a promise that a route or UI
  is operational.
- Docs must not contain environment secrets, customer data, or production
  credentials.

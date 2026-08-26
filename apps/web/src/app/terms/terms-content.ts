export type TermsBlock = {
  kind: "paragraph" | "bullet";
  text: string;
};

export type TermsSection = {
  number: number;
  title: string;
  id: string;
  blocks: TermsBlock[];
};

export const termsDocument = {
  "title": "Leadreacher.ai\nTerms and Conditions",
  "effectiveDate": "August 25, 2026",
  "contractingEntity": "Generately Inc., operating as Leadreacher.ai",
  "notice": "IMPORTANT: These Terms are intended for business customers. By creating an account, purchasing a subscription, connecting a third-party account, launching a campaign, or otherwise using the Services, you agree to these Terms. If you use the Services for an organization, you represent that you have authority to bind it.",
  "sections": [
    {
      "number": 1,
      "title": "Agreement and Scope",
      "id": "section-1",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "These Terms and Conditions (the “Terms”) govern access to and use of the Leadreacher.ai website and the Leadreacher software platform, applications, APIs, artificial-intelligence features, prospecting and enrichment tools, content-generation functionality, campaign and outreach functionality, integrations, dashboards, analytics, and related services (collectively, the “Services”). The Services are provided by Generately Inc., operating as Leadreacher.ai (“Leadreacher,” “we,” “us,” or “our”)."
        },
        {
          "kind": "paragraph",
          "text": "These Terms form a binding agreement between Leadreacher and the person or legal entity that accesses or uses the Services (“Customer,” “you,” or “your”). If an Order Form, Data Processing Addendum (“DPA”), enterprise agreement, or other written agreement executed by Leadreacher applies to your account, it forms part of the agreement and will control to the extent it expressly conflicts with these Terms."
        }
      ]
    },
    {
      "number": 2,
      "title": "Business Use; Authority; Eligibility",
      "id": "section-2",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The Services are designed primarily for business-to-business commercial and professional use and are not offered for personal, family, or household purposes. You represent and warrant that you are at least the age of majority where you reside, have legal capacity to enter into these Terms, and, if acting for an organization, have authority to bind that organization."
        },
        {
          "kind": "paragraph",
          "text": "If mandatory consumer-protection law applies despite the intended business use of the Services, nothing in these Terms limits a right or remedy that cannot lawfully be waived."
        }
      ]
    },
    {
      "number": 3,
      "title": "Description of the Services",
      "id": "section-3",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Depending on your plan, configuration, location, third-party integrations, and feature availability, the Services may assist with business and website analysis, market and audience analysis, prospect discovery and enrichment, campaign strategy, AI-assisted content and message generation, personalized media, social and messaging-channel selection, campaign scheduling or execution, analytics, reply and conversion tracking, and related customer-acquisition activities."
        },
        {
          "kind": "paragraph",
          "text": "Leadreacher may modify, add, replace, limit, or discontinue features as the Services evolve, including where required by law, security considerations, third-party platform changes, capacity constraints, or product development. We will use commercially reasonable efforts to provide notice of materially adverse changes to paid core functionality when practicable."
        }
      ]
    },
    {
      "number": 4,
      "title": "Account Registration and Security",
      "id": "section-4",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "You must provide accurate and current registration, billing, and account information. You are responsible for safeguarding credentials, multi-factor authentication methods, API keys, connected accounts, and devices used to access the Services, and for all activity conducted through your account by authorized users."
        },
        {
          "kind": "paragraph",
          "text": "You must promptly notify Leadreacher of suspected unauthorized access, credential compromise, or misuse. Leadreacher may require identity, account, payment, or authority verification where reasonably necessary to protect the Services, prevent fraud, or satisfy legal or platform requirements."
        }
      ]
    },
    {
      "number": 5,
      "title": "Authorized Users and Customer Administration",
      "id": "section-5",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer may permit its employees, contractors, and agents to use the Services solely for Customer’s business and subject to these Terms. Customer is responsible for their acts and omissions as if they were Customer’s own. Customer must promptly remove access for persons who are no longer authorized."
        }
      ]
    },
    {
      "number": 6,
      "title": "Customer Authorization for Integrations",
      "id": "section-6",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "When you connect a website, social-media account, messaging service, CRM, advertising account, storage service, API, database, or other third-party resource, you represent that you own or are authorized to use it and to grant the permissions required for Leadreacher and its subprocessors to provide the requested Services. You authorize Leadreacher to access, receive, process, transmit, and act on information from connected services to the extent reasonably necessary to execute your instructions."
        },
        {
          "kind": "paragraph",
          "text": "You remain responsible for compliance with the terms, rules, permissions, rate limits, and policies of each connected third-party service."
        }
      ]
    },
    {
      "number": 7,
      "title": "Customer Responsibility for Campaigns",
      "id": "section-7",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher provides software, automation, content-generation, and decision-support tools. Customer remains the sender, advertiser, marketer, or business operator responsible for campaigns conducted through Customer’s account unless a written agreement expressly states otherwise."
        },
        {
          "kind": "paragraph",
          "text": "Before initiating or approving a campaign, Customer is responsible for determining whether each communication, audience, data use, claim, offer, and channel is lawful and appropriate, including whether consent, a lawful basis, an exemption, identification information, disclosure, or an opt-out mechanism is required."
        }
      ]
    },
    {
      "number": 8,
      "title": "Electronic Marketing and Anti-Spam Compliance",
      "id": "section-8",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer must comply with all laws that apply to commercial electronic messages, direct marketing, electronic communications, telemarketing, privacy, advertising, and consumer protection. These may include Canada’s Anti-Spam Legislation (“CASL”), the CAN-SPAM Act, applicable U.S. state laws, the GDPR and ePrivacy rules where applicable, and comparable laws in other jurisdictions."
        },
        {
          "kind": "paragraph",
          "text": "For communications subject to CASL, Customer must have and be able to demonstrate a valid basis for sending the communication, including express consent, implied consent, or an applicable statutory or regulatory exemption, as the circumstances require. Customer is also responsible for required sender identification, contact information, and a functioning unsubscribe mechanism where required."
        },
        {
          "kind": "paragraph",
          "text": "The availability of a messaging feature or a third-party social platform does not mean that a communication is exempt from CASL or other law. Customer must not rely on a platform-specific exemption unless the facts and functionality of the particular messaging service satisfy the applicable legal requirements."
        }
      ]
    },
    {
      "number": 9,
      "title": "Consent, Evidence, and Recordkeeping",
      "id": "section-9",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer must maintain records reasonably sufficient to substantiate any consent, implied-consent relationship, business relationship, referral, exemption, or other lawful basis on which Customer relies for outreach. Customer must provide such records to Leadreacher where reasonably requested to investigate complaints, protect the Services, respond to a regulator, or verify compliance."
        }
      ]
    },
    {
      "number": 10,
      "title": "Unsubscribe, Opt-Out, and Suppression Requirements",
      "id": "section-10",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer must honour valid unsubscribe, opt-out, suppression, do-not-contact, objection, and withdrawal-of-consent requests within the period required by applicable law. Customer may not intentionally circumvent Leadreacher suppression controls or re-import a suppressed recipient for the purpose of continuing prohibited outreach."
        },
        {
          "kind": "paragraph",
          "text": "Leadreacher may maintain global, account-level, channel-level, or campaign-level suppression mechanisms where reasonably necessary for compliance, platform integrity, abuse prevention, or recipient protection."
        }
      ]
    },
    {
      "number": 11,
      "title": "Prospect Data and Business Contact Information",
      "id": "section-11",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The Services may locate, receive, organize, enrich, rank, infer, or present information about businesses and potential business contacts from Customer-provided information, public-facing sources, licensed providers, APIs, integrations, and other sources. Prospect data is provided as a business-development aid, not as a representation that a person has consented to contact or that any particular use is lawful."
        },
        {
          "kind": "paragraph",
          "text": "Customer must independently determine the lawfulness and appropriateness of collecting, using, storing, enriching, profiling, or contacting each prospect. Leadreacher does not warrant that prospect information is complete, current, accurate, or suitable for a particular campaign."
        }
      ]
    },
    {
      "number": 12,
      "title": "Publicly Accessible Information Is Not Unrestricted Data",
      "id": "section-12",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer acknowledges that information visible on the internet may still constitute personal information and may remain subject to privacy, data-protection, contractual, intellectual-property, and platform restrictions. Customer may not use the Services for indiscriminate scraping, harvesting, re-identification, or repurposing of personal information where such activity is unlawful or inconsistent with a person’s reasonable expectations or applicable legal requirements."
        }
      ]
    },
    {
      "number": 13,
      "title": "Sensitive and High-Risk Personal Data",
      "id": "section-13",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Unless Leadreacher expressly enables and authorizes a specific use case in writing, Customer must not upload, infer, target, segment, or make decisions using the Services based on highly sensitive personal information, including health or medical information, precise geolocation, financial account credentials, government identifiers, biometric identifiers, sexual life or orientation, religious or philosophical beliefs, political opinions, union membership, criminal history, or information about children."
        },
        {
          "kind": "paragraph",
          "text": "Customer must not use the Services to make or materially assist high-impact decisions concerning employment, housing, credit, lending, insurance, education admissions, health care, immigration, policing, or access to essential services unless Leadreacher has expressly approved the use case and Customer has implemented legally required safeguards and human review."
        }
      ]
    },
    {
      "number": 14,
      "title": "Privacy and Data Protection",
      "id": "section-14",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Each party must comply with privacy and data-protection laws applicable to its own processing activities. Depending on context, these may include the Personal Information Protection and Electronic Documents Act (“PIPEDA”), substantially similar provincial privacy laws in Canada, Quebec private-sector privacy requirements, the GDPR, UK GDPR, U.S. state privacy laws, and other applicable legislation."
        },
        {
          "kind": "paragraph",
          "text": "The parties’ legal roles in relation to personal information may vary by processing activity. Where Leadreacher processes personal information on Customer’s documented instructions as a service provider or processor, the applicable DPA will govern that processing. Leadreacher may separately process account, billing, security, fraud-prevention, service-usage, and business-contact information for its own legitimate operational purposes as described in its Privacy Policy."
        }
      ]
    },
    {
      "number": 15,
      "title": "Privacy Management and Individual Rights",
      "id": "section-15",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer is responsible for providing legally required privacy notices, establishing any required lawful basis or consent, responding to access, correction, deletion, objection, or similar requests that relate to Customer-controlled data, and conducting privacy or algorithmic impact assessments where required or appropriate."
        },
        {
          "kind": "paragraph",
          "text": "Leadreacher may provide reasonable assistance for verified privacy requests relating to data processed on Customer’s behalf, subject to the DPA, technical feasibility, and reasonable cost where the request is unusually burdensome."
        }
      ]
    },
    {
      "number": 16,
      "title": "Cross-Border Data Processing",
      "id": "section-16",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer acknowledges that the Services may involve processing by Leadreacher and authorized service providers in jurisdictions outside Customer’s province, state, or country. Such processing is subject to the safeguards, contractual measures, and disclosures described in the Privacy Policy and, where applicable, the DPA. Customer is responsible for any transfer assessment or local-law requirement that applies specifically to Customer’s use of the Services."
        }
      ]
    },
    {
      "number": 17,
      "title": "Customer Content",
      "id": "section-17",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "“Customer Content” means data, text, prompts, files, websites, logos, trademarks, images, videos, audio, prospect lists, business information, campaign materials, instructions, and other content submitted, connected, or made available by Customer through the Services. As between the parties, Customer retains its rights in Customer Content."
        },
        {
          "kind": "paragraph",
          "text": "Customer grants Leadreacher and its authorized subprocessors a worldwide, non-exclusive, royalty-free licence to host, copy, transmit, transform, format, analyze, display, and otherwise process Customer Content solely as reasonably necessary to provide, secure, maintain, support, and improve the Services, comply with Customer instructions, prevent abuse, and comply with law, subject to the Privacy Policy and DPA where applicable."
        }
      ]
    },
    {
      "number": 18,
      "title": "Customer Content Warranties",
      "id": "section-18",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer represents and warrants that it has all rights, permissions, notices, consents, and lawful bases required to provide Customer Content to Leadreacher and to instruct the processing requested. Customer Content and Customer’s use of it must not infringe intellectual-property, confidentiality, privacy, publicity, personality, contractual, or other rights."
        }
      ]
    },
    {
      "number": 19,
      "title": "Aggregated and De-Identified Information",
      "id": "section-19",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher may create and use aggregated, statistical, or de-identified information derived from operation of the Services for analytics, security, benchmarking, capacity planning, product improvement, and business operations, provided that such information does not reasonably identify Customer or an individual and is not used to re-identify an individual."
        }
      ]
    },
    {
      "number": 20,
      "title": "Artificial Intelligence Features",
      "id": "section-20",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Some Services use machine learning, generative AI, large language models, automated classification, recommendation systems, and third-party AI services (“AI Features”). AI Features are probabilistic and can produce inaccurate, incomplete, outdated, biased, offensive, duplicative, or otherwise unsuitable output."
        },
        {
          "kind": "paragraph",
          "text": "Unless Leadreacher expressly states that a workflow is fully managed and reviewed by Leadreacher, Customer is responsible for human review of AI-generated output before relying on it for material business decisions, publishing it, or transmitting it to prospects. Customer must not represent AI-generated factual claims as verified unless Customer has reasonably validated them."
        }
      ]
    },
    {
      "number": 21,
      "title": "AI Transparency and Prohibited Manipulation",
      "id": "section-21",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer may not use AI Features to create deceptive impersonations, fabricated endorsements or testimonials, materially misleading synthetic media, fraudulent identities, or content designed to mislead a recipient about a material fact. Where applicable law requires disclosure that content is AI-generated or synthetic, Customer is responsible for providing that disclosure."
        }
      ]
    },
    {
      "number": 22,
      "title": "AI Personalization, Inferences, and Fairness",
      "id": "section-22",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer must not use AI Features to infer highly sensitive traits, exploit vulnerabilities, discriminate unlawfully, or target persons based on protected characteristics in a manner prohibited by law. Customer is responsible for assessing the accuracy, appropriateness, and fairness of material inferences about identifiable persons before using them."
        }
      ]
    },
    {
      "number": 23,
      "title": "AI Output and Intellectual Property",
      "id": "section-23",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Subject to these Terms and third-party rights, Customer may use output generated for Customer through the Services for its lawful business purposes. Leadreacher does not guarantee that AI-generated output is unique, non-infringing, copyrightable, trademarkable, or eligible for any particular form of intellectual-property protection. Similar or identical output may be generated for other users."
        }
      ]
    },
    {
      "number": 24,
      "title": "Personalized Images, Video, Audio, and Avatars",
      "id": "section-24",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer is responsible for obtaining any rights or permissions legally required to use names, likenesses, images, voices, trademarks, logos, recordings, copyrighted works, or other assets supplied for personalized media. Customer must not falsely imply that a prospect, public figure, employee, customer, or other person endorsed, said, performed, or approved something that they did not."
        }
      ]
    },
    {
      "number": 25,
      "title": "Advertising Claims, Testimonials, and Offers",
      "id": "section-25",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer is solely responsible for the truthfulness and substantiation of claims contained in its campaigns, including performance, savings, comparison, “best,” “highest,” conversion-rate, scarcity, price, environmental, testimonial, case-study, and endorsement claims. Customer must not use a testimonial, review, test result, or endorsement without any approval, disclosure, substantiation, or other requirement imposed by applicable law."
        },
        {
          "kind": "paragraph",
          "text": "Customer must ensure that advertised prices and offers are materially accurate and that mandatory non-governmental charges are not concealed or presented in a manner that creates a misleading general impression."
        }
      ]
    },
    {
      "number": 26,
      "title": "Leadreacher Intellectual Property",
      "id": "section-26",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher and its licensors retain all rights, title, and interest in the Services and related technology, including software, source and object code, algorithms, models, workflows, interfaces, designs, databases, architecture, prompts and prompt systems developed by Leadreacher, methodologies, templates, documentation, trademarks, and know-how (“Leadreacher IP”)."
        },
        {
          "kind": "paragraph",
          "text": "Subject to these Terms and payment of applicable fees, Leadreacher grants Customer a limited, non-exclusive, non-transferable, non-sublicensable right during the subscription term to access and use the Services for Customer’s internal business purposes."
        }
      ]
    },
    {
      "number": 27,
      "title": "Restrictions on the Services",
      "id": "section-27",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Except to the extent a restriction is prohibited by law, Customer may not: reverse engineer, decompile, disassemble, copy, scrape, mirror, or extract Leadreacher IP; bypass technical safeguards or usage limits; use the Services to build or train a substantially competing product through systematic extraction of proprietary functionality or output; resell or sublicense the Services without written authorization; or remove proprietary notices."
        }
      ]
    },
    {
      "number": 28,
      "title": "Feedback",
      "id": "section-28",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "If Customer voluntarily provides ideas, suggestions, or feedback about the Services, Customer grants Leadreacher a perpetual, irrevocable, worldwide, royalty-free right to use and incorporate that feedback without restriction or compensation, provided this does not transfer ownership of Customer’s confidential information or Customer Content."
        }
      ]
    },
    {
      "number": 29,
      "title": "Acceptable Use",
      "id": "section-29",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer may use the Services only for lawful business purposes. Without limiting any other restriction, Customer may not use the Services to:"
        },
        {
          "kind": "bullet",
          "text": "commit or facilitate fraud, phishing, credential theft, malware distribution, unauthorized access, or cyber abuse;"
        },
        {
          "kind": "bullet",
          "text": "harass, threaten, stalk, intimidate, exploit, or unlawfully discriminate against a person;"
        },
        {
          "kind": "bullet",
          "text": "send communications that Customer knows or should know are unlawful or prohibited;"
        },
        {
          "kind": "bullet",
          "text": "circumvent opt-outs, suppression lists, platform controls, consent requirements, or rate limits;"
        },
        {
          "kind": "bullet",
          "text": "impersonate a person or organization deceptively or falsify message origin;"
        },
        {
          "kind": "bullet",
          "text": "collect, purchase, sell, enrich, or use unlawfully obtained personal information;"
        },
        {
          "kind": "bullet",
          "text": "infringe copyright, trademark, publicity, privacy, confidentiality, or other rights;"
        },
        {
          "kind": "bullet",
          "text": "publish defamatory, fraudulent, or materially misleading content;"
        },
        {
          "kind": "bullet",
          "text": "facilitate illegal goods, illegal services, trafficking, exploitation, or other criminal activity;"
        },
        {
          "kind": "bullet",
          "text": "probe, scan, penetrate, interfere with, overload, or disrupt Leadreacher or a third-party system without authorization;"
        },
        {
          "kind": "bullet",
          "text": "use automated activity at volumes or in a manner intended to evade third-party platform safeguards; or"
        },
        {
          "kind": "bullet",
          "text": "engage in conduct that Leadreacher reasonably determines creates material legal, security, deliverability, platform, recipient-safety, or reputational risk."
        }
      ]
    },
    {
      "number": 30,
      "title": "Restricted Industries and Use Cases",
      "id": "section-30",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher may restrict or require enhanced review for industries or activities presenting heightened regulatory, fraud, safety, or platform risk, including regulated financial services, health services, gambling, adult services, weapons, controlled substances, political campaigning, credit repair, debt collection, and other categories designated by Leadreacher. Availability of the Services does not constitute approval of a Customer’s industry, campaign, or legal compliance."
        }
      ]
    },
    {
      "number": 31,
      "title": "Third-Party Services and Platforms",
      "id": "section-31",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The Services may depend on third-party social networks, messaging services, data providers, hosting providers, AI providers, payment processors, analytics providers, and APIs. Leadreacher does not control these third parties and is not responsible for their availability, content, security, pricing, policies, decisions, outages, changes, or termination of access."
        },
        {
          "kind": "paragraph",
          "text": "A third-party platform may restrict, flag, rate-limit, suspend, or terminate Customer’s account. Leadreacher does not guarantee continued compatibility with any particular third-party service."
        }
      ]
    },
    {
      "number": 32,
      "title": "API and Integration Changes",
      "id": "section-32",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "If a third party changes, restricts, prices, suspends, or discontinues an API or feature, Leadreacher may modify, substitute, limit, or discontinue affected functionality. Such a change will not constitute a breach of these Terms where materially caused by circumstances outside Leadreacher’s reasonable control."
        }
      ]
    },
    {
      "number": 33,
      "title": "Usage and Campaign Limits",
      "id": "section-33",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher may impose plan-based or risk-based limits on prospects, messages, connected accounts, campaigns, generated content, media generation, data processing, storage, API calls, or other resources. Leadreacher may temporarily reduce activity where reasonably necessary to protect account health, deliverability, platform relationships, system integrity, security, recipients, or legal compliance."
        }
      ]
    },
    {
      "number": 34,
      "title": "No Guarantee of Leads, Conversion, or Revenue",
      "id": "section-34",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Marketing and sales outcomes depend on factors outside Leadreacher’s control. LEADREACHER DOES NOT GUARANTEE ANY PARTICULAR NUMBER OR RATE OF LEADS, REPLIES, MEETINGS, IMPRESSIONS, ENGAGEMENTS, CUSTOMERS, SALES, CONVERSIONS, REVENUE, RETURN ON INVESTMENT, OR OTHER BUSINESS RESULT."
        },
        {
          "kind": "paragraph",
          "text": "Benchmarks, demonstrations, case studies, projections, conversion-rate examples, testimonials, or historical performance are illustrative only unless expressly guaranteed in a signed Order Form. Actual results vary by market, offer, pricing, competition, audience, deliverability, brand, campaign configuration, sales execution, seasonality, platform behaviour, and other factors."
        }
      ]
    },
    {
      "number": 35,
      "title": "Analytics and Attribution",
      "id": "section-35",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Analytics may depend on third-party data and may be delayed, incomplete, estimated, duplicated, blocked, or attributed differently among systems. Leadreacher does not warrant that metrics displayed in the Services will exactly match third-party platforms, Customer systems, or independent attribution tools."
        }
      ]
    },
    {
      "number": 36,
      "title": "Subscriptions and Orders",
      "id": "section-36",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Paid Services are offered under the plan, billing period, usage allowances, and price presented at checkout or in an applicable Order Form. By purchasing a subscription, Customer authorizes Leadreacher and its payment processor to charge the applicable fees and taxes to the selected payment method."
        }
      ]
    },
    {
      "number": 37,
      "title": "Automatic Renewal",
      "id": "section-37",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Unless expressly stated otherwise at checkout or in an Order Form, subscriptions automatically renew for successive periods equal to the then-current billing period until cancelled. Customer authorizes recurring charges at the then-applicable price, subject to any notice required by law or contract."
        }
      ]
    },
    {
      "number": 38,
      "title": "Fees, Taxes, and Pricing Transparency",
      "id": "section-38",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Fees are stated in the currency shown at checkout or in the Order Form. Unless expressly stated otherwise, quoted fees exclude government-imposed sales, use, value-added, GST/HST, withholding, or similar taxes. Leadreacher will not intentionally add undisclosed mandatory non-governmental charges that make an advertised subscription price unattainable."
        },
        {
          "kind": "paragraph",
          "text": "Customer is responsible for applicable taxes except taxes imposed on Leadreacher’s net income. Where Customer is legally required to withhold tax from a payment, Customer will provide appropriate documentation and, unless prohibited by law or otherwise agreed, pay amounts necessary so Leadreacher receives the contracted net fees."
        }
      ]
    },
    {
      "number": 39,
      "title": "Price Changes",
      "id": "section-39",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher may change pricing for future purchases and renewals. For an existing recurring subscription, a price increase will take effect no earlier than the next renewal after reasonable notice, unless an Order Form states otherwise. Continued use after the effective renewal constitutes acceptance of the new price."
        }
      ]
    },
    {
      "number": 40,
      "title": "Payment Failure and Chargebacks",
      "id": "section-40",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "If payment fails, Leadreacher may retry the payment method, request updated billing information, restrict paid features, suspend access, or terminate the subscription. Customer remains responsible for properly incurred fees. Customer agrees to contact Leadreacher in good faith regarding a billing dispute before initiating an improper chargeback; this does not limit any non-waivable payment-card right."
        }
      ]
    },
    {
      "number": 41,
      "title": "Cancellation and Refunds",
      "id": "section-41",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer may cancel a self-service subscription using the account cancellation functionality made available by Leadreacher or another designated cancellation method. Unless otherwise stated, cancellation takes effect at the end of the current paid billing period and prevents future renewal charges."
        },
        {
          "kind": "paragraph",
          "text": "Except where required by law, stated in an Order Form, or expressly offered under a published refund policy, fees already paid or incurred are non-refundable and no credits are provided for partial billing periods, unused capacity, or unused Services."
        }
      ]
    },
    {
      "number": 42,
      "title": "Trials, Credits, and Promotions",
      "id": "section-42",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Trials, credits, beta access, discounts, and promotional offers may be subject to additional terms, eligibility limits, expiration dates, and usage restrictions. Leadreacher may modify or discontinue a promotion prospectively, subject to commitments already made and applicable law."
        }
      ]
    },
    {
      "number": 43,
      "title": "Suspension",
      "id": "section-43",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher may suspend or restrict access where reasonably necessary due to suspected fraud, security threats, payment default, legal requirements, third-party platform requirements, credible spam or privacy complaints, abusive or excessive use, material breach, or risk to Leadreacher, recipients, other customers, or service providers. Where appropriate and legally permitted, Leadreacher will attempt to provide notice and a reasonable opportunity to cure."
        }
      ]
    },
    {
      "number": 44,
      "title": "Termination",
      "id": "section-44",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Either party may terminate an agreement for material breach if the breach is not cured within a reasonable period after written notice where cure is possible. Leadreacher may terminate immediately for fraud, serious unlawful conduct, intentional security abuse, repeated or egregious spam violations, deliberate circumvention of safeguards, infringement, or conduct creating material legal or operational risk."
        },
        {
          "kind": "paragraph",
          "text": "Termination ends Customer’s right to use the Services. Accrued payment obligations and provisions that by their nature should survive will survive, including confidentiality, intellectual property, disclaimers, indemnification, limitations of liability, governing law, and dispute provisions."
        }
      ]
    },
    {
      "number": 45,
      "title": "Data Export, Retention, and Deletion",
      "id": "section-45",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer should export data it requires before termination where export functionality is available. After termination, Leadreacher may delete or de-identify Customer data in accordance with its retention practices, Privacy Policy, DPA, backup cycles, legal obligations, security requirements, fraud prevention, and dispute-resolution needs. Leadreacher is not required to retain Customer data indefinitely."
        }
      ]
    },
    {
      "number": 46,
      "title": "Security",
      "id": "section-46",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher will use commercially reasonable administrative, technical, and organizational safeguards designed to protect the Services and personal information under its control, taking account of sensitivity and risk. No internet-based service can be guaranteed completely secure or uninterrupted."
        },
        {
          "kind": "paragraph",
          "text": "Customer is responsible for the security of its own systems, devices, credentials, personnel, integrations, and connected accounts, and for configuring available security controls appropriately."
        }
      ]
    },
    {
      "number": 47,
      "title": "Security Incidents",
      "id": "section-47",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher will address security incidents affecting personal information in accordance with applicable law and any applicable DPA. Customer must promptly provide information reasonably requested to investigate a security incident attributable to Customer systems, credentials, content, or users."
        }
      ]
    },
    {
      "number": 48,
      "title": "Confidentiality",
      "id": "section-48",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Each party may receive non-public business, technical, commercial, security, financial, or product information of the other (“Confidential Information”). The receiving party will use reasonable safeguards, use Confidential Information only for the relationship contemplated by these Terms, and disclose it only to personnel and service providers who need to know it and are bound by appropriate obligations."
        },
        {
          "kind": "paragraph",
          "text": "Confidential Information excludes information that is lawfully public without breach, already lawfully known without restriction, independently developed without use of the confidential information, or lawfully obtained from a third party without confidentiality restriction. A party may disclose information where legally required, subject to lawful notice where permitted."
        }
      ]
    },
    {
      "number": 49,
      "title": "Beta, Preview, and Experimental Features",
      "id": "section-49",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Beta, preview, early-access, experimental, or development features may contain errors, change materially, have limited support, or be discontinued. They are provided “as is” and should not be relied on for mission-critical activities unless Leadreacher expressly agrees otherwise in writing."
        }
      ]
    },
    {
      "number": 50,
      "title": "Service Availability and Maintenance",
      "id": "section-50",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher aims to provide a reliable service but does not guarantee uninterrupted or error-free operation unless a separate service-level agreement expressly applies. Maintenance, upgrades, internet failures, security events, third-party outages, API changes, and events beyond reasonable control may affect availability."
        }
      ]
    },
    {
      "number": 51,
      "title": "Professional Advice Disclaimer",
      "id": "section-51",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The Services and generated recommendations are not legal, tax, accounting, investment, employment, privacy, or other regulated professional advice. Customer should obtain qualified advice where its use case raises legal or regulatory questions, including questions about outreach consent, data use, international transfers, or regulated industries."
        }
      ]
    },
    {
      "number": 52,
      "title": "Disclaimer of Warranties",
      "id": "section-52",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” LEADREACHER DISCLAIMS ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS NOT EXPRESSLY SET OUT IN THESE TERMS, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING IMPLIED WARRANTIES OR CONDITIONS OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, AND QUIET ENJOYMENT."
        },
        {
          "kind": "paragraph",
          "text": "LEADREACHER DOES NOT WARRANT THAT THE SERVICES, AI OUTPUTS, PROSPECT DATA, ANALYTICS, OR THIRD-PARTY INTEGRATIONS WILL BE UNINTERRUPTED, ERROR-FREE, COMPLETELY SECURE, ACCURATE, OR SUITABLE FOR EVERY CUSTOMER OR CAMPAIGN. NOTHING IN THESE TERMS EXCLUDES A WARRANTY OR RIGHT THAT CANNOT LAWFULLY BE EXCLUDED."
        }
      ]
    },
    {
      "number": 53,
      "title": "Limitation of Liability",
      "id": "section-53",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEADREACHER AND ITS AFFILIATES, DIRECTORS, OFFICERS, EMPLOYEES, CONTRACTORS, AGENTS, LICENSORS, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, BUSINESS, OPPORTUNITY, CUSTOMERS, GOODWILL, REPUTATION, DATA, OR ANTICIPATED SAVINGS, ARISING OUT OF OR RELATING TO THE SERVICES OR THESE TERMS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES."
        },
        {
          "kind": "paragraph",
          "text": "TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEADREACHER’S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE SERVICES AND THESE TERMS WILL NOT EXCEED THE FEES ACTUALLY PAID OR PAYABLE BY CUSTOMER TO LEADREACHER FOR THE SERVICES GIVING RISE TO THE CLAIM DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE FIRST EVENT GIVING RISE TO LIABILITY."
        },
        {
          "kind": "paragraph",
          "text": "The exclusions and cap apply collectively to all theories of liability, including contract, tort, negligence, statute, and otherwise, but do not apply to liability that cannot lawfully be limited or excluded."
        }
      ]
    },
    {
      "number": 54,
      "title": "Specific Third-Party and Platform Risk",
      "id": "section-54",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Without limiting Section 53, Leadreacher is not responsible for losses caused by third-party account suspension, platform enforcement, rate limits, API restrictions, algorithm changes, messaging limitations, loss of account access, third-party outages, third-party data inaccuracies, or Customer’s violation of third-party terms."
        }
      ]
    },
    {
      "number": 55,
      "title": "Indemnification by Customer",
      "id": "section-55",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "To the maximum extent permitted by law, Customer will defend, indemnify, and hold harmless Leadreacher and its affiliates, officers, directors, employees, contractors, agents, licensors, and service providers from third-party claims, liabilities, damages, judgments, penalties, fines, costs, and reasonable legal fees arising out of or relating to: Customer Content; Customer campaigns or communications; Customer’s products or services; Customer’s breach of these Terms; Customer’s violation of law or third-party terms; misleading marketing claims; unlawful processing or misuse of personal information; intellectual-property, privacy, publicity, or personality-right infringement caused by materials or instructions supplied by Customer; or Customer’s misuse of the Services."
        },
        {
          "kind": "paragraph",
          "text": "Leadreacher will provide reasonable notice of an indemnified claim and reasonable cooperation. Customer may control the defence with counsel reasonably acceptable to Leadreacher, but may not settle a claim in a manner that admits wrongdoing by, imposes obligations on, or restricts Leadreacher without Leadreacher’s written consent."
        }
      ]
    },
    {
      "number": 56,
      "title": "Export Controls, Sanctions, and Anti-Corruption",
      "id": "section-56",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer may not use, export, re-export, transfer, or provide the Services in violation of applicable trade sanctions, export controls, anti-boycott, anti-bribery, or anti-corruption laws. Customer represents that it is not prohibited from receiving the Services under applicable sanctions or export-control rules."
        }
      ]
    },
    {
      "number": 57,
      "title": "Force Majeure",
      "id": "section-57",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Neither party will be liable for delay or failure caused by events beyond its reasonable control, including natural disaster, severe weather, fire, flood, war, terrorism, civil unrest, labour disruption, epidemic, governmental action, utility or telecommunications failure, internet disruption, cloud-provider outage, cybersecurity event affecting a third party, or material API failure. This section does not excuse Customer’s obligation to pay fees already due for Services provided."
        }
      ]
    },
    {
      "number": 58,
      "title": "Changes to These Terms",
      "id": "section-58",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Leadreacher may update these Terms to reflect changes to the Services, law, technology, security practices, third-party requirements, or business operations. The current version will display its effective date. Where a change materially reduces an existing Customer’s contractual rights, Leadreacher will provide reasonable notice where required or commercially appropriate. Continued use after the updated Terms take effect constitutes acceptance to the extent permitted by law."
        }
      ]
    },
    {
      "number": 59,
      "title": "Electronic Communications and Notices",
      "id": "section-59",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer consents to receive agreements, notices, disclosures, receipts, billing information, security notices, and other communications electronically through email, the Services, or the Site. Customer is responsible for keeping account contact information current."
        },
        {
          "kind": "paragraph",
          "text": "Formal legal notices to Leadreacher must be delivered using the legal-contact method designated on the Leadreacher.ai website at the time notice is sent. Notices to Customer may be sent to the account owner or administrative email address on file and are deemed received when sent, subject to applicable law."
        }
      ]
    },
    {
      "number": 60,
      "title": "Governing Law and Courts",
      "id": "section-60",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Unless mandatory law requires otherwise, these Terms and any dispute arising out of or relating to them or the Services are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict-of-law principles. Subject to Section 61, the parties attorn to the exclusive jurisdiction of the courts located in Toronto, Ontario, Canada."
        }
      ]
    },
    {
      "number": 61,
      "title": "Good-Faith Dispute Resolution",
      "id": "section-61",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Before commencing a court proceeding, a party will provide written notice describing the dispute and requested resolution and the parties will attempt in good faith to resolve the matter for at least thirty (30) days. This requirement does not prevent a party from seeking urgent injunctive or equitable relief or taking action necessary to preserve a limitation period or legal right."
        }
      ]
    },
    {
      "number": 62,
      "title": "Injunctive and Equitable Relief",
      "id": "section-62",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Either party may seek urgent injunctive or equitable relief where reasonably necessary to address unauthorized access, misuse of intellectual property, misuse or disclosure of Confidential Information, cybersecurity harm, fraud, or other circumstances in which monetary damages would be inadequate."
        }
      ]
    },
    {
      "number": 63,
      "title": "Assignment",
      "id": "section-63",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Customer may not assign these Terms without Leadreacher’s prior written consent, except as part of a bona fide merger, acquisition, corporate reorganization, or sale of substantially all assets relating to Customer’s use of the Services, provided the successor is not a direct competitor of Leadreacher and assumes Customer’s obligations. Leadreacher may assign these Terms in connection with a merger, financing, acquisition, reorganization, sale of assets, or transfer of the Leadreacher business."
        }
      ]
    },
    {
      "number": 64,
      "title": "Independent Parties",
      "id": "section-64",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The parties are independent contractors. Nothing in these Terms creates a partnership, franchise, joint venture, employment, fiduciary, or agency relationship. Neither party may bind the other except as expressly agreed in writing."
        }
      ]
    },
    {
      "number": 65,
      "title": "No Third-Party Beneficiaries",
      "id": "section-65",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Except for persons expressly entitled to indemnification or limitation-of-liability protections under these Terms, these Terms do not create enforceable rights in any third party."
        }
      ]
    },
    {
      "number": 66,
      "title": "Waiver and Severability",
      "id": "section-66",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "A failure to enforce a provision is not a waiver. If any provision is held unlawful, invalid, or unenforceable, it will be modified to the minimum extent necessary to make it enforceable where possible, and the remaining provisions will continue in effect."
        }
      ]
    },
    {
      "number": 67,
      "title": "Interpretation",
      "id": "section-67",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Headings are for convenience only. “Including” and “includes” mean “including without limitation.” References to laws include applicable amendments, regulations, and successor legislation. The English-language version of these Terms controls to the extent permitted by law unless another language version is expressly stated to control."
        }
      ]
    },
    {
      "number": 68,
      "title": "Order of Precedence",
      "id": "section-68",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "If documents forming the agreement conflict, the following order applies unless a later signed agreement expressly states otherwise: (1) an executed enterprise or master services agreement; (2) an executed Order Form; (3) an applicable DPA solely for data-protection matters; (4) these Terms; and (5) other policies incorporated by reference."
        }
      ]
    },
    {
      "number": 69,
      "title": "Entire Agreement",
      "id": "section-69",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "These Terms, the Privacy Policy, any applicable DPA, Acceptable Use Policy, Order Form, and other documents expressly incorporated by reference constitute the entire agreement concerning the Services and supersede prior or contemporaneous discussions and representations concerning the same subject matter, except for a separately executed agreement that expressly supersedes them."
        }
      ]
    },
    {
      "number": 70,
      "title": "Contact",
      "id": "section-70",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Questions about these Terms may be submitted through the contact or support method designated on the Leadreacher.ai website. Legal notices must follow Section 59."
        }
      ]
    },
    {
      "number": 71,
      "title": "Acknowledgement",
      "id": "section-71",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "BY CREATING AN ACCOUNT, PURCHASING A SUBSCRIPTION, CONNECTING A THIRD-PARTY ACCOUNT, LAUNCHING OR APPROVING A CAMPAIGN, OR OTHERWISE USING THE SERVICES, CUSTOMER ACKNOWLEDGES THAT IT HAS READ AND UNDERSTOOD THESE TERMS, HAS AUTHORITY TO ACCEPT THEM, AND AGREES TO BE BOUND BY THEM."
        },
        {
          "kind": "paragraph",
          "text": "Customer further acknowledges that Leadreacher does not guarantee leads, conversions, sales, revenue, or continued access to any third-party platform, and that Customer remains responsible for the lawfulness of its campaigns, communications, data use, claims, and connected accounts."
        }
      ]
    }
  ],
  "publisher": "Generately Inc., operating as Leadreacher.ai\nToronto, Ontario, Canada"
} as const satisfies {
  title: string;
  effectiveDate: string;
  contractingEntity: string;
  notice: string;
  sections: readonly TermsSection[];
  publisher: string;
};


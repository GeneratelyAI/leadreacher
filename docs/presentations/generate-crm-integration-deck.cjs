const path = require("node:path");
const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();

pptx.layout = "LAYOUT_WIDE";
pptx.author = "LeadReacher";
pptx.company = "LeadReacher";
pptx.subject = "Benefits of connecting LeadReacher with a CRM";
pptx.title = "CRM integration deck";
pptx.lang = "en-CA";
pptx.theme = {
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  lang: "en-CA",
};

// Keep every text element consistent, including legacy elements with an
// explicit font set in their local options.
const addSlide = pptx.addSlide.bind(pptx);
pptx.addSlide = (...args) => {
  const slide = addSlide(...args);
  const addText = slide.addText.bind(slide);
  slide.addText = (text, options = {}) => addText(text, { ...options, fontFace: "Arial" });
  return slide;
};
pptx.defineSlideMaster({
  title: "LEADREACHER_LIGHT",
  background: { color: "FCFCFE" },
  objects: [],
  slideNumber: { x: 12.55, y: 7.1, w: 0.25, h: 0.16, color: "85899A", fontFace: "Aptos", fontSize: 8, align: "right", margin: 0 },
});

const C = {
  ink: "101426",
  inkDeep: "050A1F",
  purple: "5A32ED",
  purpleBright: "6945DB",
  lavender: "EEE9FF",
  lavenderSoft: "F7F5FF",
  lavenderLine: "D7CCFF",
  muted: "646A7E",
  soft: "8A8FA0",
  border: "E6E2F2",
  white: "FFFFFF",
  green: "159956",
  greenSoft: "EAF8F0",
};

const outputPath = path.join(__dirname, "CRM Integration Deck.pptx");
const logoPath = path.resolve(__dirname, "../../apps/web/public/logo/leadreacher_logo_colored_transparent.svg");
const logoWhitePath = path.resolve(__dirname, "../../apps/web/public/logo/leadreacher_logo_white_transparent.svg");
const logoIconPath = path.resolve(__dirname, "../../apps/web/public/logo/leadreacher_icon_colored.svg");
const statfloLogoPath = path.resolve(__dirname, "assets/statflo-logo.svg");
const overviewScreenPath = path.resolve(__dirname, "assets/dashboard-overview-deck.png");
const messagesScreenPath = path.resolve(__dirname, "assets/dashboard-messages-light.png");
const campaignsScreenPath = path.resolve(__dirname, "assets/dashboard-campaigns-light.png");

const outerShadow = {
  type: "outer",
  color: "CFC7E8",
  blur: 2,
  angle: 45,
  distance: 1,
  opacity: 0.16,
};

function addHeader(slide, section = "CRM INTEGRATION") {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.28,
    y: 0.2,
    w: 12.77,
    h: 0.56,
    rectRadius: 0.12,
    fill: { color: C.white, transparency: 3 },
    line: { color: C.border, width: 0.7 },
    shadow: outerShadow,
  });
  slide.addImage({ path: logoPath, x: 0.52, y: 0.34, w: 2.45, h: 0.21 });
  slide.addText(section, {
    x: 10.35,
    y: 0.37,
    w: 2.35,
    h: 0.14,
    fontFace: "Aptos",
    fontSize: 8.5,
    bold: true,
    color: C.purple,
    charSpacing: 1.7,
    align: "right",
    margin: 0,
  });
}

function addEyebrow(slide, text, x, y, w = 4) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: C.purple,
    charSpacing: 2,
    margin: 0,
  });
}

function addTitle(slide, first, second, y = 1.25, x = 0.72, w = 11.9) {
  slide.addText(first, {
    x,
    y,
    w,
    h: 0.55,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  slide.addText(second, {
    x,
    y: y + 0.48,
    w,
    h: 0.62,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: C.purple,
    margin: 0,
  });
}

function addFooterLine(slide, text = "LeadReacher CRM integration benefits") {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.72,
    y: 6.98,
    w: 11.85,
    h: 0,
    line: { color: C.border, width: 0.65 },
  });
  slide.addText(text, {
    x: 0.72,
    y: 7.07,
    w: 5.5,
    h: 0.13,
    fontFace: "Aptos",
    fontSize: 7.5,
    color: C.soft,
    margin: 0,
  });
}

function addNumberBadge(slide, number, x, y, fill = C.lavender) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: 0.43,
    h: 0.43,
    fill: { color: fill },
    line: { color: C.lavenderLine, width: 0.8 },
  });
  slide.addText(number, {
    x,
    y: y + 0.11,
    w: 0.43,
    h: 0.13,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: C.purple,
    align: "center",
    margin: 0,
  });
}

function addCheck(slide, x, y, size = 0.29) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: size,
    h: size,
    fill: { color: C.greenSoft },
    line: { color: C.green, width: 1 },
  });
  slide.addText("✓", {
    x,
    y: y + 0.055,
    w: size,
    h: size * 0.48,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: C.green,
    align: "center",
    margin: 0,
  });
}

function addBenefitLine(slide, title, detail, x, y, w) {
  addCheck(slide, x, y + 0.01, 0.25);
  slide.addText(title, {
    x: x + 0.38,
    y,
    w: w - 0.38,
    h: 0.21,
    fontFace: "Aptos",
    fontSize: 12.5,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  slide.addText(detail, {
    x: x + 0.38,
    y: y + 0.28,
    w: w - 0.38,
    h: 0.48,
    fontFace: "Aptos",
    fontSize: 10.5,
    color: C.muted,
    breakLine: false,
    valign: "top",
    margin: 0,
    fit: "shrink",
  });
}

function addSmallTag(slide, text, x, y, w) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.36,
    rectRadius: 0.08,
    fill: { color: C.lavenderSoft },
    line: { color: C.lavenderLine, width: 0.7 },
  });
  slide.addText(text, {
    x: x + 0.12,
    y: y + 0.1,
    w: w - 0.24,
    h: 0.12,
    fontFace: "Aptos",
    fontSize: 8.5,
    bold: true,
    color: C.purple,
    align: "center",
    margin: 0,
  });
}

function addDashboardFrame(slide, x, y, w, h, active) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.13,
    fill: { color: "F7F8FC" }, line: { color: "D8DCE8", width: 0.8 }, shadow: outerShadow,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x + 0.14, y: y + 0.14, w: 1.55, h: h - 0.28, rectRadius: 0.07,
    fill: { color: C.inkDeep }, line: { color: C.inkDeep },
  });
  slide.addImage({ path: logoWhitePath, x: x + 0.34, y: y + 0.42, w: 1.12, h: 0.1 });
  ["Overview", "Conversations", "Campaigns", "Prospects", "Analytics"].forEach((item, index) => {
    const navY = y + 1.05 + index * 0.55;
    if (item === active) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.27, y: navY - 0.07, w: 1.3, h: 0.4, rectRadius: 0.06,
        fill: { color: C.purple }, line: { color: C.purple },
      });
    }
    slide.addText(item, {
      x: x + 0.43, y: navY, w: 1.02, h: 0.13, margin: 0, fontFace: "Aptos", fontSize: 7.6,
      bold: item === active, color: item === active ? C.white : "B9BECD",
    });
  });
  return { x: x + 1.92, y: y + 0.33, w: w - 2.2, h: h - 0.66 };
}

function addMetric(slide, label, value, x, y, w, trend) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.82, rectRadius: 0.06,
    fill: { color: C.white }, line: { color: C.border, width: 0.6 },
  });
  slide.addText(label, { x: x + 0.16, y: y + 0.14, w: w - 0.32, h: 0.11, margin: 0, fontSize: 6.8, color: C.muted });
  slide.addText(value, { x: x + 0.16, y: y + 0.34, w: w - 0.32, h: 0.26, margin: 0, fontSize: 16, bold: true, color: C.ink });
  slide.addText(trend, { x: x + w - 0.65, y: y + 0.48, w: 0.48, h: 0.1, margin: 0, fontSize: 6.3, bold: true, color: C.green, align: "right" });
}

function addPracticalCallout(slide, number, heading, detail, x, y, w) {
  slide.addText(number, { x, y, w: 0.36, h: 0.13, margin: 0, fontSize: 8, bold: true, color: C.purple });
  slide.addText(heading, { x: x + 0.45, y: y - 0.02, w: w - 0.45, h: 0.18, margin: 0, fontSize: 10.5, bold: true, color: C.ink });
  slide.addText(detail, { x: x + 0.45, y: y + 0.23, w: w - 0.45, h: 0.42, margin: 0, fontSize: 8.3, color: C.muted, valign: "top", fit: "shrink" });
}

// Slide 1: Cover
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "STATFLO PARTNERSHIP PROPOSAL");
  addEyebrow(slide, "LEADREACHER + STATFLO", 0.74, 1.42, 4.2);
  slide.addText("Qualified outreach", {
    x: 0.72,
    y: 1.82,
    w: 6.25,
    h: 0.75,
    fontFace: "Aptos Display",
    fontSize: 43,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  slide.addText("integration", {
    x: 0.72,
    y: 2.5,
    w: 6.25,
    h: 0.75,
    fontFace: "Aptos Display",
    fontSize: 43,
    bold: true,
    color: C.purple,
    margin: 0,
  });
  slide.addText("Turn approved Statflo audiences into personalized, reviewable outreach at scale.", {
    x: 0.76,
    y: 3.52,
    w: 5.35,
    h: 0.72,
    fontFace: "Aptos",
    fontSize: 18,
    color: C.muted,
    breakLine: false,
    margin: 0,
    fit: "shrink",
  });
  addSmallTag(slide, "SMART LISTS", 0.76, 4.62, 1.36);
  addSmallTag(slide, "PERSONALIZED VIDEO", 2.3, 4.62, 1.94);
  addSmallTag(slide, "COMBINED REPORTING", 4.42, 4.62, 1.88);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.1,
    y: 1.36,
    w: 5.45,
    h: 4.95,
    rectRadius: 0.18,
    fill: { color: C.lavenderSoft },
    line: { color: C.lavenderLine, width: 0.8 },
    shadow: outerShadow,
  });
  slide.addImage({ path: logoIconPath, x: 7.71, y: 2.34, w: 1.2, h: 1.2 });
  slide.addShape(pptx.ShapeType.line, {
    x: 8.93,
    y: 2.95,
    w: 1.72,
    h: 0,
    line: { color: C.purple, width: 1.8, beginArrowType: "none", endArrowType: "triangle" },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 10.7,
    y: 2.25,
    w: 1.38,
    h: 1.38,
    fill: { color: C.white },
    line: { color: C.purple, width: 1.5 },
  });
  slide.addImage({ path: statfloLogoPath, x: 10.82, y: 2.68, w: 1.18, h: 0.42 });
  slide.addText("Each platform does what it does best.", {
    x: 7.72,
    y: 4.15,
    w: 3.95,
    h: 0.6,
    fontFace: "Aptos Display",
    fontSize: 18,
    bold: true,
    color: C.ink,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  slide.addText("Statflo owns customer records and compliant conversations. LeadReacher handles audience intelligence, personalized outreach and campaign reporting.", {
    x: 7.82,
    y: 4.92,
    w: 3.75,
    h: 0.64,
    fontFace: "Aptos",
    fontSize: 11.5,
    color: C.muted,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addFooterLine(slide, "LeadReacher + Statflo integration proposal");
}

// Previous broad concept slide retained in source for reference, excluded from output.
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide);
  addEyebrow(slide, "ONE CONNECTED CUSTOMER JOURNEY", 0.72, 1.13, 5.2);
  addTitle(slide, "One connected path.", "From outreach to revenue.", 1.48);
  slide.addText("The CRM becomes the shared history for every conversation LeadReacher creates.", {
    x: 7.72,
    y: 1.72,
    w: 4.7,
    h: 0.67,
    fontFace: "Aptos",
    fontSize: 15,
    color: C.muted,
    margin: 0,
    fit: "shrink",
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 1.35,
    y: 3.65,
    w: 10.58,
    h: 0,
    line: { color: C.lavenderLine, width: 2.2 },
  });

  const journey = [
    {
      number: "01",
      x: 1.1,
      title: "Qualified outreach",
      detail: "LeadReacher creates relevant conversations with the right prospects.",
    },
    {
      number: "02",
      x: 4.95,
      title: "Complete context",
      detail: "The CRM retains who replied, why they engaged and where they came from.",
    },
    {
      number: "03",
      x: 8.8,
      title: "Sales momentum",
      detail: "Teams follow up from a familiar workflow without losing the conversation history.",
    },
  ];

  for (const item of journey) {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: item.x,
      y: 3.12,
      w: 1.08,
      h: 1.08,
      fill: { color: C.white },
      line: { color: C.purple, width: 1.5 },
      shadow: outerShadow,
    });
    slide.addText(item.number, {
      x: item.x,
      y: 3.5,
      w: 1.08,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 12,
      bold: true,
      color: C.purple,
      align: "center",
      margin: 0,
    });
    slide.addText(item.title, {
      x: item.x - 0.05,
      y: 4.48,
      w: 3.05,
      h: 0.3,
      fontFace: "Aptos Display",
      fontSize: 17,
      bold: true,
      color: C.ink,
      margin: 0,
    });
    slide.addText(item.detail, {
      x: item.x - 0.05,
      y: 4.95,
      w: 3.05,
      h: 0.84,
      fontFace: "Aptos",
      fontSize: 11.5,
      color: C.muted,
      valign: "top",
      margin: 0,
      fit: "shrink",
    });
  }

  addSmallTag(slide, "NO LOST CONTEXT", 1.08, 6.18, 1.83);
  addSmallTag(slide, "CLEANER HANDOFFS", 4.9, 6.18, 2.02);
  addSmallTag(slide, "ONE CUSTOMER HISTORY", 8.73, 6.18, 2.25);
  addFooterLine(slide);
}

// Previous broad concept slide retained in source for reference, excluded from output.
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide);
  addEyebrow(slide, "BENEFITS FOR THE SALES TEAM", 0.72, 1.12, 5.2);
  addTitle(slide, "More selling.", "Less admin.", 1.46);
  slide.addText("Keep the team focused on conversations and next actions, not duplicate entry.", {
    x: 7.42,
    y: 1.73,
    w: 4.95,
    h: 0.62,
    fontFace: "Aptos",
    fontSize: 15,
    color: C.muted,
    margin: 0,
    fit: "shrink",
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72,
    y: 2.78,
    w: 6.28,
    h: 3.65,
    rectRadius: 0.16,
    fill: { color: C.white },
    line: { color: C.border, width: 0.8 },
    shadow: outerShadow,
  });
  slide.addText("NEW CRM ACTIVITY", {
    x: 1.08,
    y: 3.13,
    w: 2.2,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 8.5,
    bold: true,
    color: C.purple,
    charSpacing: 1.4,
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 1.08,
    y: 3.65,
    w: 0.62,
    h: 0.62,
    fill: { color: C.lavender },
    line: { color: C.lavenderLine, width: 0.7 },
  });
  slide.addText("R", {
    x: 1.08,
    y: 3.84,
    w: 0.62,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 11,
    bold: true,
    color: C.purple,
    align: "center",
    margin: 0,
  });
  slide.addText("Prospect replied", {
    x: 1.92,
    y: 3.61,
    w: 2.7,
    h: 0.3,
    fontFace: "Aptos Display",
    fontSize: 16,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  slide.addText("Campaign context and conversation history are attached.", {
    x: 1.92,
    y: 4.04,
    w: 3.85,
    h: 0.48,
    fontFace: "Aptos",
    fontSize: 10.5,
    color: C.muted,
    margin: 0,
    fit: "shrink",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 1.08,
    y: 4.83,
    w: 5.52,
    h: 0,
    line: { color: C.border, width: 0.7 },
  });
  slide.addText("SOURCE", {
    x: 1.08,
    y: 5.15,
    w: 0.88,
    h: 0.15,
    fontFace: "Aptos",
    fontSize: 8,
    bold: true,
    color: C.soft,
    margin: 0,
  });
  slide.addText("LeadReacher campaign", {
    x: 2.18,
    y: 5.12,
    w: 2.15,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  slide.addText("NEXT ACTION", {
    x: 1.08,
    y: 5.62,
    w: 1.02,
    h: 0.15,
    fontFace: "Aptos",
    fontSize: 8,
    bold: true,
    color: C.soft,
    margin: 0,
  });
  slide.addText("Follow up while interest is fresh", {
    x: 2.18,
    y: 5.59,
    w: 2.85,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  addCheck(slide, 6.05, 5.42, 0.35);

  addBenefitLine(slide, "Replies retain context", "The source, campaign and conversation stay connected for the rep.", 7.58, 2.98, 4.4);
  addBenefitLine(slide, "Fewer duplicate updates", "Less copying between outreach tools, notes and CRM records.", 7.58, 4.05, 4.4);
  addBenefitLine(slide, "Faster follow-up", "Teams can act from the workflow they already know and use every day.", 7.58, 5.12, 4.4);
  addFooterLine(slide);
}

// Previous broad concept slide retained in source for reference, excluded from output.
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide);
  addEyebrow(slide, "BENEFITS FOR SALES LEADERS", 0.72, 1.13, 5.2);
  addTitle(slide, "The pipeline becomes", "easier to trust.", 1.48);
  slide.addText("Outreach activity, opportunity progress and revenue context can tell one consistent story.", {
    x: 7.32,
    y: 1.72,
    w: 5.08,
    h: 0.7,
    fontFace: "Aptos",
    fontSize: 15,
    color: C.muted,
    margin: 0,
    fit: "shrink",
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72,
    y: 2.82,
    w: 12.0,
    h: 1.46,
    rectRadius: 0.15,
    fill: { color: C.lavenderSoft },
    line: { color: C.lavenderLine, width: 0.8 },
  });
  const stages = ["OUTREACH", "REPLY", "OPPORTUNITY", "REVENUE"];
  for (let index = 0; index < stages.length; index += 1) {
    const stageX = 1.05 + index * 2.95;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: stageX,
      y: 3.22,
      w: 0.56,
      h: 0.56,
      fill: { color: index === 3 ? C.greenSoft : C.white },
      line: { color: index === 3 ? C.green : C.purple, width: 1.1 },
    });
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: stageX,
      y: 3.41,
      w: 0.56,
      h: 0.14,
      fontFace: "Aptos",
      fontSize: 8.5,
      bold: true,
      color: index === 3 ? C.green : C.purple,
      align: "center",
      margin: 0,
    });
    slide.addText(stages[index], {
      x: stageX + 0.78,
      y: 3.38,
      w: 1.5,
      h: 0.16,
      fontFace: "Aptos",
      fontSize: 9.5,
      bold: true,
      color: C.ink,
      charSpacing: 0.7,
      margin: 0,
    });
    if (index < stages.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: stageX + 2.18,
        y: 3.5,
        w: 0.58,
        h: 0,
        line: { color: C.lavenderLine, width: 1.2, endArrowType: "triangle" },
      });
    }
  }

  addBenefitLine(slide, "Campaign-level attribution", "Understand which outreach creates replies, opportunities and commercial momentum.", 0.92, 4.86, 3.62);
  addBenefitLine(slide, "Cleaner customer records", "Give teams a more complete history with fewer gaps and fewer duplicates.", 4.88, 4.86, 3.62);
  addBenefitLine(slide, "Shared visibility", "Sales and leadership can work from the same view of pipeline progress.", 8.84, 4.86, 3.62);
  addFooterLine(slide);
}

// Slide 2: Overview dashboard
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "01 | QUALIFIED AUDIENCES");
  addEyebrow(slide, "LEADREACHER-QUALIFIED SMART LISTS", 0.72, 1.03, 5.2);
  slide.addText("Benefit 1: Review-ready audiences.", { x: 0.72, y: 1.3, w: 7.4, h: 0.48, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("Start with an approved Statflo Smart List, then identify and prepare the most relevant audience.", { x: 8.42, y: 1.34, w: 3.9, h: 0.42, margin: 0, fontSize: 11, color: C.muted, fit: "shrink" });
  const f = addDashboardFrame(slide, 0.72, 2.02, 9.08, 4.55, "Overview");
  slide.addText("Good afternoon, Nicolas", { x: f.x, y: f.y, w: 3.3, h: 0.24, margin: 0, fontFace: "Aptos Display", fontSize: 15, bold: true, color: C.ink });
  addSmallTag(slide, "ENGINE RUNNING", f.x + f.w - 1.34, f.y - 0.03, 1.28);
  addMetric(slide, "PROSPECTS", "1,248", f.x, f.y + 0.5, 1.42, "+18%");
  addMetric(slide, "REPLIES", "312", f.x + 1.58, f.y + 0.5, 1.42, "+12%");
  addMetric(slide, "MEETINGS", "47", f.x + 3.16, f.y + 0.5, 1.42, "+9%");
  addMetric(slide, "CUSTOMERS", "11", f.x + 4.74, f.y + 0.5, 1.42, "+4");
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x, y: f.y + 1.56, w: 3.9, h: 2.24, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.border, width: 0.6 } });
  slide.addText("Needs your attention", { x: f.x + 0.18, y: f.y + 1.76, w: 2.2, h: 0.17, margin: 0, fontSize: 9.2, bold: true, color: C.ink });
  [["Sarah Kim", "Replied · Northstar campaign", "2m"], ["Michael Tran", "Asked for pricing", "18m"], ["Priya Shah", "Meeting intent detected", "1h"]].forEach((row, i) => {
    const yy = f.y + 2.13 + i * 0.48;
    slide.addShape(pptx.ShapeType.ellipse, { x: f.x + 0.18, y: yy, w: 0.28, h: 0.28, fill: { color: i === 2 ? "E9F2FF" : C.lavender }, line: { color: C.lavenderLine, width: 0.5 } });
    slide.addText(row[0], { x: f.x + 0.58, y: yy + 0.01, w: 1.35, h: 0.1, margin: 0, fontSize: 7.2, bold: true, color: C.ink });
    slide.addText(row[1], { x: f.x + 0.58, y: yy + 0.16, w: 2.42, h: 0.09, margin: 0, fontSize: 6.3, color: C.muted });
    slide.addText(row[2], { x: f.x + 3.28, y: yy + 0.08, w: 0.4, h: 0.08, margin: 0, fontSize: 6.2, color: C.soft, align: "right" });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x + 4.12, y: f.y + 1.56, w: 2.52, h: 2.24, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.border, width: 0.6 } });
  slide.addText("CRM sync", { x: f.x + 4.3, y: f.y + 1.76, w: 1.2, h: 0.17, margin: 0, fontSize: 9.2, bold: true, color: C.ink });
  addSmallTag(slide, "LIVE", f.x + 5.62, f.y + 1.69, 0.65);
  [["New leads", "38"], ["Activities written", "126"], ["Open tasks", "9"], ["Sync errors", "0"]].forEach((row, i) => {
    const yy = f.y + 2.18 + i * 0.36;
    slide.addText(row[0], { x: f.x + 4.3, y: yy, w: 1.45, h: 0.1, margin: 0, fontSize: 6.8, color: C.muted });
    slide.addText(row[1], { x: f.x + 5.73, y: yy, w: 0.46, h: 0.1, margin: 0, fontSize: 7.2, bold: true, color: C.ink, align: "right" });
  });
  slide.addShape(pptx.ShapeType.rect, { x: 8.81, y: 2.01, w: 1.36, h: 4.58, fill: { color: "FCFCFE" }, line: { color: "FCFCFE" } });
  slide.addImage({ path: overviewScreenPath, x: 0.72, y: 2.02, w: 8.09, h: 4.55 });
  addPracticalCallout(slide, "01", "Statflo customers", "Existing customer records remain owned and managed in Statflo.", 10.06, 2.4, 2.48);
  addPracticalCallout(slide, "02", "Similar prospects", "LeadReacher can identify relevant new audiences using approved data.", 10.06, 3.7, 2.48);
  addPracticalCallout(slide, "03", "Approval first", "Prospective outreach follows customer approval, consent and channel rules.", 10.06, 5.0, 2.48);
  addFooterLine(slide, "LeadReacher + Statflo | qualified audience view");
}

// Slide 3: Conversation handoff
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "02 | PERSONALIZED OUTREACH");
  addEyebrow(slide, "MESSAGING THAT EARNS ATTENTION", 0.72, 1.03, 5.2);
  slide.addText("Benefit 2: More relevant outreach.", { x: 0.72, y: 1.3, w: 7.4, h: 0.48, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("LeadReacher creates personalized messages and video for each approved contact or audience.", { x: 8.42, y: 1.34, w: 3.9, h: 0.42, margin: 0, fontSize: 11, color: C.muted, fit: "shrink" });
  const f = addDashboardFrame(slide, 0.72, 2.02, 9.08, 4.55, "Conversations");
  slide.addText("Conversations", { x: f.x, y: f.y, w: 2.2, h: 0.24, margin: 0, fontFace: "Aptos Display", fontSize: 15, bold: true, color: C.ink });
  addSmallTag(slide, "4 NEED REPLY", f.x + 2.0, f.y - 0.03, 1.05);
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x, y: f.y + 0.48, w: 2.48, h: 3.34, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.border, width: 0.6 } });
  [["Sarah Kim", "This looks relevant. Can we talk?", "2m"], ["Michael Tran", "Can you send pricing?", "18m"], ["David Ross", "Thursday works.", "1h"], ["Emily Lee", "What happens next?", "2h"]].forEach((row, i) => {
    const yy = f.y + 0.62 + i * 0.75;
    if (i === 0) slide.addShape(pptx.ShapeType.roundRect, { x: f.x + 0.08, y: yy - 0.06, w: 2.32, h: 0.65, rectRadius: 0.04, fill: { color: C.lavender }, line: { color: C.lavenderLine, width: 0.5 } });
    slide.addShape(pptx.ShapeType.ellipse, { x: f.x + 0.18, y: yy + 0.05, w: 0.34, h: 0.34, fill: { color: i === 0 ? C.purpleBright : "E9EDF5" }, line: { color: "D5D9E3", width: 0.4 } });
    slide.addText(row[0], { x: f.x + 0.64, y: yy + 0.01, w: 1.08, h: 0.1, margin: 0, fontSize: 7.1, bold: true, color: C.ink });
    slide.addText(row[1], { x: f.x + 0.64, y: yy + 0.2, w: 1.38, h: 0.18, margin: 0, fontSize: 6.1, color: C.muted, fit: "shrink" });
    slide.addText(row[2], { x: f.x + 1.97, y: yy + 0.03, w: 0.26, h: 0.08, margin: 0, fontSize: 5.8, color: C.soft, align: "right" });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x + 2.66, y: f.y + 0.48, w: 4.08, h: 3.34, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.border, width: 0.6 } });
  slide.addText("Sarah Kim", { x: f.x + 2.88, y: f.y + 0.66, w: 1.45, h: 0.15, margin: 0, fontSize: 9, bold: true, color: C.ink });
  slide.addText("VP Growth · Common Thread", { x: f.x + 2.88, y: f.y + 0.88, w: 2.1, h: 0.1, margin: 0, fontSize: 6.5, color: C.muted });
  addSmallTag(slide, "LINKEDIN", f.x + 5.62, f.y + 0.62, 0.83);
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x + 3.03, y: f.y + 1.31, w: 2.78, h: 0.67, rectRadius: 0.07, fill: { color: "F1F3F8" }, line: { color: "F1F3F8" } });
  slide.addText("Hi Sarah, I recorded a short idea for Common Thread’s growth team.", { x: f.x + 3.2, y: f.y + 1.49, w: 2.44, h: 0.28, margin: 0, fontSize: 6.6, color: C.muted, fit: "shrink" });
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x + 3.58, y: f.y + 2.17, w: 2.55, h: 0.62, rectRadius: 0.07, fill: { color: C.lavender }, line: { color: C.lavenderLine } });
  slide.addText("This looks relevant. Can we talk?", { x: f.x + 3.75, y: f.y + 2.37, w: 2.2, h: 0.18, margin: 0, fontSize: 7, bold: true, color: C.ink });
  slide.addShape(pptx.ShapeType.line, { x: f.x + 2.87, y: f.y + 3.02, w: 3.54, h: 0, line: { color: C.border, width: 0.6 } });
  slide.addText("CRM", { x: f.x + 2.88, y: f.y + 3.2, w: 0.35, h: 0.1, margin: 0, fontSize: 6.2, bold: true, color: C.soft });
  slide.addText("Contact matched · Activity written · Task created", { x: f.x + 3.35, y: f.y + 3.18, w: 2.82, h: 0.13, margin: 0, fontSize: 6.4, bold: true, color: C.green });
  slide.addShape(pptx.ShapeType.rect, { x: 8.81, y: 2.01, w: 1.36, h: 4.58, fill: { color: "FCFCFE" }, line: { color: "FCFCFE" } });
  slide.addImage({ path: messagesScreenPath, x: 0.72, y: 2.02, w: 8.09, h: 4.55 });
  addPracticalCallout(slide, "01", "Personalized", "Messaging and video are tailored to the person and business context.", 10.06, 2.4, 2.48);
  addPracticalCallout(slide, "02", "Reviewable", "The user approves content before anything is launched.", 10.06, 3.7, 2.48);
  addPracticalCallout(slide, "03", "Statflo-led", "Customer records, assignments and compliant conversations stay in Statflo.", 10.06, 5.0, 2.48);
  addFooterLine(slide, "LeadReacher + Statflo | personalized outreach");
}

// Slide 4: Analytics dashboard and field contract
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "03 | CAMPAIGNS");
  addEyebrow(slide, "APPROVED OUTREACH AT SCALE", 0.72, 1.03, 4.8);
  slide.addText("Benefit 3: Scale outreach with less work.", { x: 0.72, y: 1.3, w: 7.4, h: 0.48, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("Run personalized or macro-level video campaigns across eligible channels and audiences.", { x: 8.42, y: 1.34, w: 3.9, h: 0.42, margin: 0, fontSize: 11, color: C.muted, fit: "shrink" });
  const f = addDashboardFrame(slide, 0.72, 2.02, 9.08, 4.55, "Analytics");
  slide.addText("Analytics", { x: f.x, y: f.y, w: 1.6, h: 0.24, margin: 0, fontFace: "Aptos Display", fontSize: 15, bold: true, color: C.ink });
  addSmallTag(slide, "LAST 30 DAYS", f.x + f.w - 1.2, f.y - 0.03, 1.12);
  addMetric(slide, "MESSAGES", "2,840", f.x, f.y + 0.48, 1.45, "+14%");
  addMetric(slide, "REPLIES", "312", f.x + 1.58, f.y + 0.48, 1.45, "+12%");
  addMetric(slide, "REPLY RATE", "11.0%", f.x + 3.16, f.y + 0.48, 1.45, "+1.8pp");
  addMetric(slide, "MEETINGS", "47", f.x + 4.74, f.y + 0.48, 1.45, "+9%");
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x, y: f.y + 1.52, w: 4.05, h: 2.28, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.border, width: 0.6 } });
  slide.addText("Messages → replies → meetings", { x: f.x + 0.18, y: f.y + 1.72, w: 2.8, h: 0.15, margin: 0, fontSize: 8.8, bold: true, color: C.ink });
  const points = [[0, 1.32], [0.56, 1.1], [1.12, 1.18], [1.68, 0.78], [2.24, 0.9], [2.8, 0.48], [3.36, 0.62]];
  for (let i = 0; i < points.length - 1; i += 1) slide.addShape(pptx.ShapeType.line, { x: f.x + 0.35 + points[i][0], y: f.y + 3.42 - points[i][1], w: points[i + 1][0] - points[i][0], h: points[i][1] - points[i + 1][1], line: { color: C.purple, width: 2 } });
  ["Aug 01", "Aug 08", "Aug 15", "Aug 22", "Aug 29"].forEach((label, i) => slide.addText(label, { x: f.x + 0.22 + i * 0.78, y: f.y + 3.48, w: 0.58, h: 0.08, margin: 0, fontSize: 5.7, color: C.soft, align: "center" }));
  slide.addShape(pptx.ShapeType.roundRect, { x: f.x + 4.23, y: f.y + 1.52, w: 2.38, h: 2.28, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.border, width: 0.6 } });
  slide.addText("CRM outcomes", { x: f.x + 4.42, y: f.y + 1.72, w: 1.55, h: 0.15, margin: 0, fontSize: 8.8, bold: true, color: C.ink });
  [["Opportunities", "22"], ["Pipeline value", "$184k"], ["Closed won", "7"], ["Revenue", "$61k"]].forEach((row, i) => {
    const yy = f.y + 2.15 + i * 0.37;
    slide.addText(row[0], { x: f.x + 4.42, y: yy, w: 1.25, h: 0.1, margin: 0, fontSize: 6.5, color: C.muted });
    slide.addText(row[1], { x: f.x + 5.76, y: yy, w: 0.57, h: 0.1, margin: 0, fontSize: 7, bold: true, color: C.ink, align: "right" });
  });
  slide.addShape(pptx.ShapeType.rect, { x: 8.81, y: 2.01, w: 1.12, h: 4.58, fill: { color: "FCFCFE" }, line: { color: "FCFCFE" } });
  slide.addImage({ path: campaignsScreenPath, x: 0.72, y: 2.02, w: 8.09, h: 4.55 });
  addPracticalCallout(slide, "01", "Smart List in", "Begin with an audience approved inside Statflo.", 10.06, 2.4, 2.48);
  addPracticalCallout(slide, "02", "Campaign out", "LeadReacher prepares content and multi-channel delivery.", 10.06, 3.7, 2.48);
  addPracticalCallout(slide, "03", "Results back", "Campaign outcomes and opt-outs return for combined reporting.", 10.06, 5.0, 2.48);
  addFooterLine(slide, "LeadReacher + Statflo | campaign delivery");
}

// Slide 2: Proposed Smart List pilot workflow
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "01 | PROPOSED WORKFLOW");
  addEyebrow(slide, "PROPOSED STATFLO INTEGRATION", 0.72, 1.03, 4.8);
  slide.addText("Start with an approved Smart List.", { x: 0.72, y: 1.3, w: 5.35, h: 0.52, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("A practical pilot that adds LeadReacher audience intelligence and personalization without changing who owns the customer relationship.", { x: 0.72, y: 2.03, w: 5.0, h: 0.65, margin: 0, fontSize: 12.2, color: C.muted, fit: "shrink", valign: "top" });
  addBenefitLine(slide, "Statflo remains the system of record", "Customer records, assignments and compliant conversations stay in Statflo.", 0.72, 3.0, 5.05);
  addBenefitLine(slide, "LeadReacher prepares the outreach", "Relevant audiences, personalized messaging and video are prepared for review.", 0.72, 4.08, 5.05);
  addBenefitLine(slide, "Approval comes before launch", "New prospect outreach remains subject to consent, channel and jurisdictional rules.", 0.72, 5.16, 5.05);

  slide.addShape(pptx.ShapeType.roundRect, { x: 6.32, y: 1.42, w: 6.2, h: 5.25, rectRadius: 0.15, fill: { color: C.lavenderSoft }, line: { color: C.lavenderLine, width: 0.8 }, shadow: outerShadow });
  slide.addText("PROPOSED PILOT FLOW", { x: 6.72, y: 1.79, w: 2.4, h: 0.14, margin: 0, fontSize: 8, bold: true, color: C.purple, charSpacing: 1.2 });
  [
    ["01", "Approved Statflo Smart List", "Customer-approved starting audience"],
    ["02", "LeadReacher preparation", "Audience, messaging and personalized video"],
    ["03", "User review", "Approve content, audience and eligible channels"],
    ["04", "Campaign delivery", "Personalized or macro-level outreach"],
    ["05", "Combined reporting", "Outcomes and opt-outs returned to Statflo"],
  ].forEach((step, i) => {
    const yy = 2.18 + i * 0.84;
    slide.addShape(pptx.ShapeType.ellipse, { x: 6.72, y: yy, w: 0.48, h: 0.48, fill: { color: i === 2 ? C.purple : C.white }, line: { color: C.purple, width: 1 } });
    slide.addText(step[0], { x: 6.72, y: yy + 0.16, w: 0.48, h: 0.12, margin: 0, fontSize: 7.2, bold: true, color: i === 2 ? C.white : C.purple, align: "center" });
    slide.addText(step[1], { x: 7.48, y: yy + 0.01, w: 4.25, h: 0.18, margin: 0, fontSize: 10.8, bold: true, color: C.ink });
    slide.addText(step[2], { x: 7.48, y: yy + 0.27, w: 4.25, h: 0.18, margin: 0, fontSize: 8.3, color: C.muted });
    if (i < 4) slide.addShape(pptx.ShapeType.line, { x: 6.96, y: yy + 0.52, w: 0, h: 0.28, line: { color: C.lavenderLine, width: 1.2, endArrowType: "triangle" } });
  });
  addFooterLine(slide, "LeadReacher + Statflo | proposed Smart List pilot");
}

// Slide 3: Existing campaign capability
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "02 | CURRENT CAPABILITY");
  addEyebrow(slide, "CURRENT LEADREACHER PRODUCT", 0.72, 1.03, 4.8);
  slide.addText("Campaign operations already exist.", { x: 0.72, y: 1.3, w: 5.25, h: 0.52, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("LeadReacher already supports the campaign workflow that would power the proposed Statflo integration.", { x: 0.72, y: 2.05, w: 4.95, h: 0.6, margin: 0, fontSize: 12.2, color: C.muted, fit: "shrink", valign: "top" });
  addBenefitLine(slide, "Prepare and review campaigns", "Drafts and readiness checks keep the work visible before launch.", 0.72, 3.02, 4.95);
  addBenefitLine(slide, "Support multiple outreach channels", "Delivery can be matched to the audience and eligible channel.", 0.72, 4.1, 4.95);
  addBenefitLine(slide, "Track campaign outcomes", "Sent messages, replies and meetings stay connected to the campaign.", 0.72, 5.18, 4.95);
  slide.addShape(pptx.ShapeType.roundRect, { x: 6.18, y: 1.98, w: 6.15, h: 3.76, rectRadius: 0.11, fill: { color: C.white }, line: { color: C.border, width: 0.8 }, shadow: outerShadow });
  slide.addImage({ path: campaignsScreenPath, x: 6.26, y: 2.06, w: 5.99, h: 3.37 });
  addSmallTag(slide, "CURRENT PRODUCT SCREEN", 8.18, 5.82, 2.08);
  slide.addText("The Statflo Smart List connection is proposed. The campaign controls shown here are available today.", { x: 6.52, y: 6.25, w: 5.46, h: 0.24, margin: 0, fontSize: 8.1, color: C.muted, align: "center", fit: "shrink" });
  addFooterLine(slide, "LeadReacher + Statflo | existing campaign capability");
}

// Slide 4: Existing conversation capability
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "03 | CURRENT CAPABILITY");
  addEyebrow(slide, "CURRENT LEADREACHER PRODUCT", 0.72, 1.03, 4.8);
  slide.addText("Conversation management already exists.", { x: 0.72, y: 1.3, w: 5.35, h: 0.62, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("LeadReacher can surface replies with the person, channel and campaign context needed for follow-up.", { x: 0.72, y: 2.08, w: 4.95, h: 0.6, margin: 0, fontSize: 12.2, color: C.muted, fit: "shrink", valign: "top" });
  addBenefitLine(slide, "Replies stay visible", "Teams can see who replied and which campaign started the conversation.", 0.72, 3.04, 4.95);
  addBenefitLine(slide, "Context stays attached", "The contact, channel and message history remain together.", 0.72, 4.12, 4.95);
  addBenefitLine(slide, "Statflo owns the customer conversation", "The proposed integration would return relevant activity to Statflo for compliant follow-up.", 0.72, 5.2, 4.95);
  slide.addShape(pptx.ShapeType.roundRect, { x: 6.18, y: 1.98, w: 6.15, h: 3.76, rectRadius: 0.11, fill: { color: C.white }, line: { color: C.border, width: 0.8 }, shadow: outerShadow });
  slide.addImage({ path: messagesScreenPath, x: 6.26, y: 2.06, w: 5.99, h: 3.37 });
  addSmallTag(slide, "CURRENT PRODUCT SCREEN", 8.18, 5.82, 2.08);
  slide.addText("Personalized video inside Statflo is proposed. The conversation view shown here is available today.", { x: 6.52, y: 6.25, w: 5.46, h: 0.24, margin: 0, fontSize: 8.1, color: C.muted, align: "center", fit: "shrink" });
  addFooterLine(slide, "LeadReacher + Statflo | existing conversation capability");
}

// Slide 5: Commercial integration options
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "04 | BUSINESS MODELS");
  addEyebrow(slide, "TWO WAYS TO START", 0.72, 1.03, 4.2);
  slide.addText("Two ways to integrate.", { x: 0.72, y: 1.3, w: 7.0, h: 0.48, margin: 0, fontSize: 26, bold: true, color: C.ink });
  slide.addText("Both options add differentiated outreach capability while keeping Statflo at the centre of the customer relationship.", { x: 8.42, y: 1.34, w: 3.9, h: 0.42, margin: 0, fontSize: 11, color: C.muted, fit: "shrink" });

  const models = [
    {
      x: 0.72,
      number: "MODEL 1",
      title: "Dedicated outreach module",
      subtitle: "The enterprise outreach engine",
      body: "A native LeadReacher module inside Statflo for Smart Lists, audience expansion, personalized video, bulk campaigns and reporting.",
      value: "Best for platform-wide capability",
      price: "Tiered enterprise fee",
    },
    {
      x: 6.82,
      number: "MODEL 2",
      title: "Additional contact channel",
      subtitle: "The utility layer",
      body: "An Outreach action on each Statflo contact for advanced single-contact messaging and video, without bulk audience tools.",
      value: "Best for a fast, low-friction launch",
      price: "Per use or pay as you go",
    },
  ];
  models.forEach((model, i) => {
    slide.addShape(pptx.ShapeType.roundRect, { x: model.x, y: 2.05, w: 5.78, h: 4.51, rectRadius: 0.14, fill: { color: i === 0 ? C.inkDeep : C.lavenderSoft }, line: { color: i === 0 ? C.inkDeep : C.lavenderLine, width: 0.9 }, shadow: outerShadow });
    slide.addText(model.number, { x: model.x + 0.36, y: 2.42, w: 1.2, h: 0.13, margin: 0, fontSize: 7.5, bold: true, color: i === 0 ? "9F8BFF" : C.purple, charSpacing: 1.2 });
    slide.addText(model.title, { x: model.x + 0.36, y: 2.77, w: 4.9, h: 0.34, margin: 0, fontSize: 20, bold: true, color: i === 0 ? C.white : C.ink, fit: "shrink" });
    slide.addText(model.subtitle, { x: model.x + 0.36, y: 3.25, w: 4.9, h: 0.18, margin: 0, fontSize: 9.2, bold: true, color: i === 0 ? "B9ACFF" : C.purple });
    slide.addText(model.body, { x: model.x + 0.36, y: 3.73, w: 4.9, h: 0.9, margin: 0, fontSize: 11, color: i === 0 ? "D6D9E5" : C.muted, fit: "shrink", valign: "top" });
    slide.addShape(pptx.ShapeType.line, { x: model.x + 0.36, y: 4.91, w: 5.0, h: 0, line: { color: i === 0 ? "282E48" : C.lavenderLine, width: 0.7 } });
    slide.addText(model.value, { x: model.x + 0.36, y: 5.2, w: 4.9, h: 0.22, margin: 0, fontSize: 10, bold: true, color: i === 0 ? C.white : C.ink });
    slide.addText(model.price, { x: model.x + 0.36, y: 5.76, w: 3.0, h: 0.16, margin: 0, fontSize: 9, color: i === 0 ? "9F8BFF" : C.purple, bold: true });
  });
  addFooterLine(slide, "LeadReacher + Statflo | integration models");
}

// Slide 6: Recommended pilot and implementation path
if (false) {
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "05 | RECOMMENDED PILOT");
  addEyebrow(slide, "START SMALL, PROVE VALUE", 0.72, 1.03, 4.6);
  slide.addText("A focused Smart List pilot.", { x: 0.72, y: 1.3, w: 6.5, h: 0.48, margin: 0, fontSize: 27, bold: true, color: C.ink });
  slide.addText("A controlled first step that tests audience quality, personalization, approvals and reporting before a deeper rollout.", { x: 8.42, y: 1.34, w: 3.9, h: 0.42, margin: 0, fontSize: 11, color: C.muted, fit: "shrink" });

  const pilotSteps = [
    ["01", "Approved Smart List", "Statflo provides a customer-approved audience."],
    ["02", "Personalized campaign", "LeadReacher prepares messaging and video."],
    ["03", "Review before launch", "The user approves content, audience and channels."],
    ["04", "Outcomes returned", "Results and opt-outs come back for combined reporting."],
  ];
  pilotSteps.forEach((step, i) => {
    const x = 0.72 + i * 3.06;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.27, w: 2.72, h: 2.1, rectRadius: 0.11, fill: { color: i === 1 ? C.inkDeep : C.white }, line: { color: i === 1 ? C.inkDeep : C.border, width: 0.8 }, shadow: outerShadow });
    slide.addText(step[0], { x: x + 0.24, y: 2.57, w: 0.42, h: 0.14, margin: 0, fontSize: 8, bold: true, color: i === 1 ? "9F8BFF" : C.purple });
    slide.addText(step[1], { x: x + 0.24, y: 2.92, w: 2.18, h: 0.38, margin: 0, fontSize: 14, bold: true, color: i === 1 ? C.white : C.ink, fit: "shrink" });
    slide.addText(step[2], { x: x + 0.24, y: 3.48, w: 2.18, h: 0.52, margin: 0, fontSize: 9.2, color: i === 1 ? "D6D9E5" : C.muted, fit: "shrink", valign: "top" });
    if (i < 3) slide.addShape(pptx.ShapeType.line, { x: x + 2.76, y: 3.3, w: 0.24, h: 0, line: { color: C.purple, width: 1, endArrowType: "triangle" } });
  });

  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 4.8, w: 12.0, h: 1.45, rectRadius: 0.11, fill: { color: C.lavenderSoft }, line: { color: C.lavenderLine, width: 0.8 } });
  slide.addText("BEST LONG-TERM CONNECTION", { x: 1.02, y: 5.11, w: 2.3, h: 0.13, margin: 0, fontSize: 7.8, bold: true, color: C.purple, charSpacing: 1.1 });
  slide.addText("Use Statflo’s partner API where available, with CSV or SFTP as a practical fallback.", { x: 1.02, y: 5.44, w: 6.2, h: 0.28, margin: 0, fontSize: 13.5, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("Confirm support for contacts, Smart Lists, campaigns, rep assignments, opt-outs, conversation events and deep links. Needed: sandbox, API and webhook documentation, rate limits and data-retention requirements.", { x: 7.62, y: 5.13, w: 4.55, h: 0.72, margin: 0, fontSize: 8.8, color: C.muted, fit: "shrink", valign: "top" });
  addFooterLine(slide, "LeadReacher + Statflo | proposed pilot");
}

// Slide 2: What
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "01 | WHAT");
  addEyebrow(slide, "THE INTEGRATION", 0.72, 1.03, 3.6);
  slide.addText("One audience. Five connected steps.", { x: 0.72, y: 1.3, w: 7.4, h: 0.5, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("A proposed workflow that keeps Statflo at the centre of the customer relationship.", { x: 8.55, y: 1.35, w: 3.7, h: 0.36, margin: 0, fontSize: 10.8, color: C.muted, fit: "shrink" });

  const whatSteps = [
    ["01", "SMART LIST", "Approved audience"],
    ["02", "QUALIFY", "Find the best fit"],
    ["03", "PERSONALIZE", "Message + video"],
    ["04", "APPROVE", "User reviews all"],
    ["05", "REPORT", "Results return"],
  ];
  whatSteps.forEach((step, i) => {
    const x = 0.72 + i * 2.44;
    const active = i === 2;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.18, w: 2.08, h: 2.08, rectRadius: 0.12, fill: { color: active ? C.inkDeep : C.white }, line: { color: active ? C.inkDeep : C.lavenderLine, width: 0.85 }, shadow: outerShadow });
    slide.addText(step[0], { x: x + 0.22, y: 2.47, w: 0.44, h: 0.13, margin: 0, fontSize: 7.8, bold: true, color: active ? "9F8BFF" : C.purple });
    slide.addText(step[1], { x: x + 0.22, y: 2.9, w: 1.62, h: 0.2, margin: 0, fontSize: 11.5, bold: true, color: active ? C.white : C.ink, align: "center", charSpacing: 0.5 });
    slide.addText(step[2], { x: x + 0.22, y: 3.42, w: 1.62, h: 0.32, margin: 0, fontSize: 9, color: active ? "D6D9E5" : C.muted, align: "center", fit: "shrink" });
    if (i < 4) slide.addShape(pptx.ShapeType.line, { x: x + 2.12, y: 3.22, w: 0.26, h: 0, line: { color: C.purple, width: 1.25, endArrowType: "triangle" } });
  });

  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 4.72, w: 12.0, h: 1.62, rectRadius: 0.11, fill: { color: C.lavenderSoft }, line: { color: C.lavenderLine, width: 0.8 } });
  slide.addText("STATFLO OWNS", { x: 1.08, y: 5.05, w: 1.45, h: 0.13, margin: 0, fontSize: 7.8, bold: true, color: C.purple, charSpacing: 1 });
  slide.addText("Customer records, assignments and compliant conversations", { x: 1.08, y: 5.42, w: 4.75, h: 0.3, margin: 0, fontSize: 12.2, bold: true, color: C.ink, fit: "shrink" });
  slide.addShape(pptx.ShapeType.line, { x: 6.48, y: 4.98, w: 0, h: 1.05, line: { color: C.lavenderLine, width: 0.8 } });
  slide.addText("LEADREACHER OWNS", { x: 6.92, y: 5.05, w: 1.85, h: 0.13, margin: 0, fontSize: 7.8, bold: true, color: C.purple, charSpacing: 1 });
  slide.addText("Audience intelligence, personalization, outreach and reporting", { x: 6.92, y: 5.42, w: 4.95, h: 0.3, margin: 0, fontSize: 12.2, bold: true, color: C.ink, fit: "shrink" });
  addFooterLine(slide, "LeadReacher + Statflo | what the integration does");
}

// Slide 3: Why
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "02 | WHY");
  addEyebrow(slide, "ILLUSTRATIVE BUSINESS CASE", 0.72, 1.03, 4.8);
  slide.addText("More qualified conversations create the upside.", { x: 0.72, y: 1.3, w: 8.3, h: 0.5, margin: 0, fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText("Example assumptions only. Replace with Statflo data before external use.", { x: 8.65, y: 1.35, w: 3.55, h: 0.36, margin: 0, fontSize: 9.8, color: C.muted, align: "right", fit: "shrink" });

  const whySteps = [
    ["10,000", "ELIGIBLE CONTACTS", "Approved starting audience"],
    ["8%", "POSITIVE REPLIES", "800 conversations"],
    ["20%", "QUALIFIED", "160 opportunities"],
  ];
  whySteps.forEach((step, i) => {
    const x = 0.72 + i * 3.05;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.18, w: 2.68, h: 2.42, rectRadius: 0.12, fill: { color: i === 1 ? C.inkDeep : C.white }, line: { color: i === 1 ? C.inkDeep : C.lavenderLine, width: 0.85 }, shadow: outerShadow });
    slide.addText(step[0], { x: x + 0.22, y: 2.58, w: 2.24, h: 0.52, margin: 0, fontSize: 30, bold: true, color: i === 1 ? C.white : C.ink, align: "center" });
    slide.addText(step[1], { x: x + 0.22, y: 3.35, w: 2.24, h: 0.14, margin: 0, fontSize: 8, bold: true, color: i === 1 ? "9F8BFF" : C.purple, align: "center", charSpacing: 0.9 });
    slide.addText(step[2], { x: x + 0.22, y: 3.78, w: 2.24, h: 0.24, margin: 0, fontSize: 9.5, color: i === 1 ? "D6D9E5" : C.muted, align: "center", fit: "shrink" });
    if (i < 2) slide.addShape(pptx.ShapeType.line, { x: x + 2.73, y: 3.38, w: 0.25, h: 0, line: { color: C.purple, width: 1.25, endArrowType: "triangle" } });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: 9.86, y: 2.18, w: 2.86, h: 2.42, rectRadius: 0.12, fill: { color: C.purple }, line: { color: C.purple }, shadow: outerShadow });
  slide.addText("$800K", { x: 10.08, y: 2.6, w: 2.42, h: 0.56, margin: 0, fontSize: 31, bold: true, color: C.white, align: "center" });
  slide.addText("POTENTIAL PIPELINE", { x: 10.08, y: 3.35, w: 2.42, h: 0.14, margin: 0, fontSize: 8, bold: true, color: "E4DEFF", align: "center", charSpacing: 0.8 });
  slide.addText("160 × $5K opportunity value", { x: 10.08, y: 3.78, w: 2.42, h: 0.24, margin: 0, fontSize: 9.5, color: C.white, align: "center" });

  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 5.02, w: 12.0, h: 1.25, rectRadius: 0.1, fill: { color: C.lavenderSoft }, line: { color: C.lavenderLine, width: 0.8 } });
  slide.addText("REVENUE MODEL", { x: 1.05, y: 5.34, w: 1.5, h: 0.13, margin: 0, fontSize: 7.8, bold: true, color: C.purple, charSpacing: 1 });
  slide.addText("Eligible audience × positive reply rate × qualification rate × opportunity value", { x: 2.68, y: 5.27, w: 7.3, h: 0.28, margin: 0, fontSize: 13, bold: true, color: C.ink, align: "center", fit: "shrink" });
  slide.addText("Validate each input with Statflo", { x: 10.15, y: 5.34, w: 2.1, h: 0.14, margin: 0, fontSize: 8.2, color: C.muted, align: "right" });
  addFooterLine(slide, "LeadReacher + Statflo | illustrative revenue case");
}

// Slide 4: How
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "03 | HOW");
  addEyebrow(slide, "THE FIRST PILOT", 0.72, 1.03, 3.8);
  slide.addText("Start small. Prove value. Then scale.", { x: 0.72, y: 1.3, w: 7.2, h: 0.5, margin: 0, fontSize: 26, bold: true, color: C.ink });
  slide.addText("One approved Smart List gives both teams a controlled way to test the integration.", { x: 8.5, y: 1.35, w: 3.72, h: 0.36, margin: 0, fontSize: 10.8, color: C.muted, fit: "shrink" });
  const howSteps = [
    ["01", "AUDIENCE", "Statflo provides an approved Smart List"],
    ["02", "PREPARE", "LeadReacher creates messaging and video"],
    ["03", "APPROVE", "User reviews content, audience and channels"],
    ["04", "MEASURE", "Outcomes and opt-outs return to Statflo"],
  ];
  howSteps.forEach((step, i) => {
    const x = 0.72 + i * 3.06;
    const active = i === 1;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.25, w: 2.72, h: 2.72, rectRadius: 0.13, fill: { color: active ? C.inkDeep : C.white }, line: { color: active ? C.inkDeep : C.lavenderLine, width: 0.85 }, shadow: outerShadow });
    slide.addText(step[0], { x: x + 0.26, y: 2.58, w: 0.45, h: 0.13, margin: 0, fontSize: 8, bold: true, color: active ? "9F8BFF" : C.purple });
    slide.addText(step[1], { x: x + 0.26, y: 3.13, w: 2.18, h: 0.18, margin: 0, fontSize: 13.5, bold: true, color: active ? C.white : C.ink, align: "center", charSpacing: 0.5 });
    slide.addText(step[2], { x: x + 0.3, y: 3.72, w: 2.1, h: 0.55, margin: 0, fontSize: 10, color: active ? "D6D9E5" : C.muted, align: "center", fit: "shrink", valign: "mid" });
    if (i < 3) slide.addShape(pptx.ShapeType.line, { x: x + 2.76, y: 3.6, w: 0.24, h: 0, line: { color: C.purple, width: 1.25, endArrowType: "triangle" } });
  });
  addSmallTag(slide, "CUSTOMER APPROVAL", 1.0, 5.47, 1.85);
  addSmallTag(slide, "ELIGIBLE CHANNELS", 3.17, 5.47, 1.85);
  addSmallTag(slide, "CONSENT RULES", 5.34, 5.47, 1.55);
  addSmallTag(slide, "OPT-OUT SYNC", 7.21, 5.47, 1.48);
  addSmallTag(slide, "COMBINED REPORTING", 9.01, 5.47, 1.95);
  addFooterLine(slide, "LeadReacher + Statflo | how the pilot works");
}

// Slide 5: How it scales
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "04 | HOW IT SCALES");
  addEyebrow(slide, "TWO COMMERCIAL PATHS", 0.72, 1.03, 4.4);
  slide.addText("Launch lightly or build the full engine.", { x: 0.72, y: 1.3, w: 7.2, h: 0.5, margin: 0, fontSize: 26, bold: true, color: C.ink });
  slide.addText("Both paths build on LeadReacher capabilities available today.", { x: 8.5, y: 1.35, w: 3.72, h: 0.36, margin: 0, fontSize: 10.8, color: C.muted, fit: "shrink" });

  // Path 1: proposed contact-record action
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 2.08, w: 5.78, h: 4.45, rectRadius: 0.13, fill: { color: C.white }, line: { color: C.lavenderLine, width: 0.85 }, shadow: outerShadow });
  slide.addText("PROPOSED CONCEPT", { x: 1.02, y: 2.38, w: 1.55, h: 0.12, margin: 0, fontSize: 7.2, bold: true, color: C.purple, charSpacing: 0.8 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 1.02, y: 2.76, w: 5.18, h: 2.38, rectRadius: 0.09, fill: { color: "FAFAFD" }, line: { color: C.border, width: 0.75 } });
  slide.addText("STATFLO CONTACT", { x: 1.28, y: 3.02, w: 1.5, h: 0.12, margin: 0, fontSize: 7, bold: true, color: C.soft, charSpacing: 0.8 });
  slide.addShape(pptx.ShapeType.ellipse, { x: 1.28, y: 3.37, w: 0.62, h: 0.62, fill: { color: C.lavender }, line: { color: C.lavenderLine, width: 0.6 } });
  slide.addText("SK", { x: 1.28, y: 3.58, w: 0.62, h: 0.14, margin: 0, fontSize: 8.5, bold: true, color: C.purple, align: "center" });
  slide.addText("Sarah Kim", { x: 2.1, y: 3.37, w: 1.65, h: 0.18, margin: 0, fontSize: 11.2, bold: true, color: C.ink });
  slide.addText("Common Thread  |  Existing customer", { x: 2.1, y: 3.7, w: 2.7, h: 0.16, margin: 0, fontSize: 8.2, color: C.muted });
  slide.addShape(pptx.ShapeType.roundRect, { x: 4.56, y: 3.34, w: 1.28, h: 0.58, rectRadius: 0.08, fill: { color: C.purple }, line: { color: C.purple } });
  slide.addText("OUTREACH", { x: 4.7, y: 3.55, w: 1.0, h: 0.13, margin: 0, fontSize: 7.8, bold: true, color: C.white, align: "center", charSpacing: 0.6 });
  slide.addShape(pptx.ShapeType.line, { x: 1.28, y: 4.24, w: 4.56, h: 0, line: { color: C.border, width: 0.65 } });
  slide.addText("Single-contact messaging and personalized video", { x: 1.28, y: 4.5, w: 4.56, h: 0.2, margin: 0, fontSize: 9.2, color: C.muted, align: "center" });
  slide.addText("PATH 1", { x: 1.02, y: 5.52, w: 0.8, h: 0.12, margin: 0, fontSize: 7.2, bold: true, color: C.purple, charSpacing: 0.8 });
  slide.addText("Contact-level channel", { x: 1.92, y: 5.45, w: 2.8, h: 0.22, margin: 0, fontSize: 12.5, bold: true, color: C.ink });
  slide.addText("Fast pilot", { x: 1.02, y: 5.97, w: 2.0, h: 0.16, margin: 0, fontSize: 8.5, color: C.muted });
  slide.addText("Per use", { x: 4.28, y: 5.97, w: 1.65, h: 0.16, margin: 0, fontSize: 8.5, bold: true, color: C.purple, align: "right" });

  // Path 2: proposed native module
  slide.addShape(pptx.ShapeType.roundRect, { x: 6.82, y: 2.08, w: 5.78, h: 4.45, rectRadius: 0.13, fill: { color: C.inkDeep }, line: { color: C.inkDeep }, shadow: outerShadow });
  slide.addText("PROPOSED CONCEPT", { x: 7.12, y: 2.38, w: 1.55, h: 0.12, margin: 0, fontSize: 7.2, bold: true, color: "9F8BFF", charSpacing: 0.8 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.12, y: 2.76, w: 5.18, h: 2.38, rectRadius: 0.09, fill: { color: "11172E" }, line: { color: "2A3150", width: 0.75 } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.32, y: 2.93, w: 1.42, h: 0.58, rectRadius: 0.06, fill: { color: C.white }, line: { color: C.white } });
  slide.addImage({ path: statfloLogoPath, x: 7.45, y: 3.03, w: 1.16, h: 0.38 });
  slide.addShape(pptx.ShapeType.line, { x: 7.38, y: 3.58, w: 4.4, h: 0, line: { color: "2A3150", width: 0.65 } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.38, y: 3.82, w: 1.3, h: 0.82, rectRadius: 0.06, fill: { color: C.purple }, line: { color: C.purple } });
  slide.addImage({ path: logoIconPath, x: 7.67, y: 3.98, w: 0.36, h: 0.36 });
  slide.addText("LeadReacher outreach", { x: 8.98, y: 3.84, w: 2.55, h: 0.18, margin: 0, fontSize: 10.8, bold: true, color: C.white });
  slide.addText("Smart Lists  •  Audiences  •  Campaigns  •  Reporting", { x: 8.98, y: 4.22, w: 2.82, h: 0.2, margin: 0, fontSize: 7.6, color: "B9BED1", fit: "shrink" });
  slide.addText("PATH 2", { x: 7.12, y: 5.52, w: 0.8, h: 0.12, margin: 0, fontSize: 7.2, bold: true, color: "9F8BFF", charSpacing: 0.8 });
  slide.addText("Dedicated outreach module", { x: 8.02, y: 5.45, w: 3.25, h: 0.22, margin: 0, fontSize: 12.5, bold: true, color: C.white });
  slide.addText("Full platform capability", { x: 7.12, y: 5.97, w: 2.6, h: 0.16, margin: 0, fontSize: 8.5, color: "D6D9E5" });
  slide.addText("Enterprise fee", { x: 10.5, y: 5.97, w: 1.7, h: 0.16, margin: 0, fontSize: 8.5, bold: true, color: "9F8BFF", align: "right" });
  addFooterLine(slide, "LeadReacher + Statflo | commercial paths");
}

// Slide 6: Decision
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "05 | NEXT STEP");
  addEyebrow(slide, "THE DECISION", 0.72, 1.03, 3.4);
  slide.addText("Agree on one pilot and three inputs.", { x: 0.72, y: 1.3, w: 7.2, h: 0.5, margin: 0, fontSize: 26, bold: true, color: C.ink });
  slide.addText("The goal is to validate commercial value before committing to a deeper integration.", { x: 8.5, y: 1.35, w: 3.72, h: 0.36, margin: 0, fontSize: 10.8, color: C.muted, fit: "shrink" });

  slide.addShape(pptx.ShapeType.ellipse, { x: 0.9, y: 2.18, w: 3.45, h: 3.45, fill: { color: C.inkDeep }, line: { color: C.inkDeep }, shadow: outerShadow });
  slide.addText("30", { x: 1.25, y: 2.84, w: 2.75, h: 0.84, margin: 0, fontSize: 51, bold: true, color: C.white, align: "center" });
  slide.addText("DAY PILOT", { x: 1.25, y: 3.82, w: 2.75, h: 0.17, margin: 0, fontSize: 9.2, bold: true, color: "9F8BFF", align: "center", charSpacing: 1.2 });
  slide.addText("One audience. One use case. Shared measurement.", { x: 1.34, y: 4.34, w: 2.58, h: 0.42, margin: 0, fontSize: 10.5, color: "D6D9E5", align: "center", fit: "shrink" });

  const asks = [
    ["01", "AUDIENCE", "Choose the first approved Smart List and use case."],
    ["02", "ACCESS", "Confirm API support, sandbox access and fallback options."],
    ["03", "SUCCESS", "Agree on reply, opportunity and revenue measures."],
  ];
  asks.forEach((ask, i) => {
    const yy = 2.18 + i * 1.28;
    slide.addShape(pptx.ShapeType.roundRect, { x: 5.0, y: yy, w: 7.55, h: 1.02, rectRadius: 0.09, fill: { color: i === 1 ? C.lavenderSoft : C.white }, line: { color: C.lavenderLine, width: 0.75 } });
    slide.addText(ask[0], { x: 5.3, y: yy + 0.36, w: 0.45, h: 0.13, margin: 0, fontSize: 8, bold: true, color: C.purple });
    slide.addText(ask[1], { x: 5.92, y: yy + 0.31, w: 1.28, h: 0.16, margin: 0, fontSize: 10, bold: true, color: C.ink, charSpacing: 0.5 });
    slide.addText(ask[2], { x: 7.42, y: yy + 0.27, w: 4.65, h: 0.28, margin: 0, fontSize: 9.5, color: C.muted, fit: "shrink" });
  });
  slide.addText("Preferred connection: Statflo partner API. Practical fallback: CSV or SFTP.", { x: 5.05, y: 6.08, w: 7.45, h: 0.2, margin: 0, fontSize: 9, color: C.muted, align: "center" });
  addFooterLine(slide, "LeadReacher + Statflo | proposed next step");
}

// Previous broad closing retained in source for reference, excluded from output.
if (false) {
  const slide = pptx.addSlide();
  slide.background = { color: C.inkDeep };
  slide.addImage({ path: logoWhitePath, x: 0.68, y: 0.5, w: 2.45, h: 0.21 });
  slide.addText("CRM INTEGRATION DECK", {
    x: 10.08,
    y: 0.53,
    w: 2.48,
    h: 0.16,
    fontFace: "Aptos",
    fontSize: 8.5,
    bold: true,
    color: "BCAEFF",
    charSpacing: 1.7,
    align: "right",
    margin: 0,
  });
  slide.addText("LeadReacher starts", {
    x: 0.78,
    y: 1.55,
    w: 8.45,
    h: 0.7,
    fontFace: "Aptos Display",
    fontSize: 38,
    bold: true,
    color: C.white,
    margin: 0,
  });
  slide.addText("the conversation.", {
    x: 0.78,
    y: 2.18,
    w: 8.45,
    h: 0.7,
    fontFace: "Aptos Display",
    fontSize: 38,
    bold: true,
    color: C.white,
    margin: 0,
  });
  slide.addText("Your CRM carries it forward.", {
    x: 0.78,
    y: 2.94,
    w: 10.7,
    h: 0.72,
    fontFace: "Aptos Display",
    fontSize: 38,
    bold: true,
    color: "9A7FFF",
    margin: 0,
  });
  slide.addText("A connected acquisition workflow, built around the tools your team already uses.", {
    x: 0.82,
    y: 4.04,
    w: 7.2,
    h: 0.62,
    fontFace: "Aptos",
    fontSize: 17,
    color: "C7C9D4",
    margin: 0,
    fit: "shrink",
  });

  const closeBenefits = [
    { x: 0.82, title: "Connected context", detail: "Keep the customer history intact." },
    { x: 4.25, title: "Faster action", detail: "Move from reply to follow-up sooner." },
    { x: 7.68, title: "Clearer reporting", detail: "See outreach impact through the pipeline." },
  ];

  for (const item of closeBenefits) {
    slide.addShape(pptx.ShapeType.line, {
      x: item.x,
      y: 5.22,
      w: 2.82,
      h: 0,
      line: { color: "5F4BB5", width: 1 },
    });
    slide.addText(item.title, {
      x: item.x,
      y: 5.52,
      w: 2.82,
      h: 0.28,
      fontFace: "Aptos Display",
      fontSize: 16,
      bold: true,
      color: C.white,
      margin: 0,
    });
    slide.addText(item.detail, {
      x: item.x,
      y: 5.96,
      w: 2.82,
      h: 0.52,
      fontFace: "Aptos",
      fontSize: 10.5,
      color: "AEB2C2",
      margin: 0,
      fit: "shrink",
    });
  }
  slide.addText("leadreacher.com", {
    x: 10.43,
    y: 6.72,
    w: 2.1,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: "BCAEFF",
    align: "right",
    margin: 0,
  });
}

pptx.writeFile({ fileName: outputPath });

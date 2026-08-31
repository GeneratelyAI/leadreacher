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
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-CA",
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

// Slide 1: Cover
{
  const slide = pptx.addSlide("LEADREACHER_LIGHT");
  addHeader(slide, "BENEFITS OVERVIEW");
  addEyebrow(slide, "LEADREACHER × CRM", 0.74, 1.42, 4.2);
  slide.addText("CRM integration", {
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
  slide.addText("deck", {
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
  slide.addText("A connected path from first outreach to closed opportunity.", {
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
  addSmallTag(slide, "CONNECTED CONTEXT", 0.76, 4.62, 1.78);
  addSmallTag(slide, "FASTER ACTION", 2.7, 4.62, 1.46);
  addSmallTag(slide, "CLEARER REPORTING", 4.32, 4.62, 1.7);

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
  slide.addText("Outreach context arrives ready to act on.", {
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
  slide.addText("Replies, source, campaign context and next-step visibility stay together.", {
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
  addFooterLine(slide, "LeadReacher CRM integration deck");
}

// Slide 2: Connected journey
{
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

// Slide 3: Less admin
{
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

// Slide 4: Visibility
{
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

// Slide 5: Closing
{
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

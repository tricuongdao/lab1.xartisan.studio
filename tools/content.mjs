// English content for the Xartisan Studio build.
// Keyed by the i18n paths used by the cloned site (see build-src/en.json for the original).

export const brand = {
  name: "Xartisan Studio",
  short: "Xartisan",
  domain: "xartisan.studio",
  email: "vincent@xartisan.studio",
  location: "Remote · Worldwide",
  founded: "2018",
};

export const overrides = {
  "header.website": brand.domain,

  "notFound.title": "404 — Page Not Found | Xartisan Studio",

  "home.title": "Xartisan Studio — Website Design & Web App Development",
  "home.heading": "Xartisan Studio — Digital Solutions & Web Studio",
  "home.description":
    "Xartisan Studio designs and builds custom websites, digital products and motion-led interfaces for ambitious brands. Clear process, considered craft and long-term support.",
  "home.imageAlt": "Xartisan Studio 3D logo with the words Digital Solutions and Web Studio",

  "home.trajectorySentence1": "2 years",
  "home.trajectorySentence3": "50+",

  "home.trajectorySentence6": brand.short,
  "home.nextIntro": "What’s next?",
  "home.playgroundLink": "Start a project",

  "home.footerLine1": "Turn your idea",
  "home.footerLine2": "into an interface",
  "home.footerLine3": brand.email,
  "home.legalNotice": "Independent design studio",
  "home.footerCopyright": "© 2026 Xartisan Studio",
  "home.footerContact": "Contact",
  "home.footerCompany": "Studio",
  "home.footerCeo": "About the studio",
  "home.footerAddress": brand.location,
  "home.footerProfile": "Studio profile",
  "home.footerProof": "Design, build and motion — all under one roof",

  "home.labLabel": "Independent studio",
  "home.labSkills": "3D · Motion · Design",
  "home.labCta": "Start a project",
};

// Strings that only exist in the markup (not in the i18n dictionary).
export const htmlOnly = {
  introTagline: "Digital Solutions · Web Studio",
  introWord: "XARTISAN",
};

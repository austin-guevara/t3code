import { describe, expect, it } from "vite-plus/test";

import { bestSessionForLink } from "./linkRouting";

describe("bestSessionForLink", () => {
  const sessions = [
    {
      key: "venues",
      title: "Offsite venues",
      tabs: [{ url: "https://docs.example.com/venues", title: "Venue shortlist" }],
    },
    { key: "deploy", title: "Fix the deploy script", tabs: [] },
  ];

  it("places a link beside a tab on the same site, or by shared title words", () => {
    expect(bestSessionForLink("https://sheets.example.com/budget", sessions)).toBe("venues");
    expect(bestSessionForLink("https://ci.acme.dev/deploy/script-logs", sessions)).toBe("deploy");
  });

  it("starts a session when nothing matches clearly", () => {
    expect(bestSessionForLink("https://news.site.org/today", sessions)).toBeNull();
    const twins = [
      { key: "a", title: null, tabs: [{ url: "https://a.figma.com/x", title: null }] },
      { key: "b", title: null, tabs: [{ url: "https://b.figma.com/y", title: null }] },
    ];
    expect(bestSessionForLink("https://figma.com/file", twins)).toBeNull();
  });
});

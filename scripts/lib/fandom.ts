import * as cheerio from "cheerio";

export interface FandomPageData {
  display_name: string | null;
  image_url: string | null;
  categories: string[];
}

export function parseFandomPage(html: string): FandomPageData {
  const $ = cheerio.load(html);

  const display_name =
    $(".page-header__title").first().text().trim() ||
    $("h1.page-header__title").first().text().trim() ||
    $("h1#firstHeading").first().text().trim() ||
    null;

  let image_url: string | null = null;
  // Prefer the panel_image inside the infobox (skips the placeholder hero image).
  $("figure.pi-image").each((_, fig) => {
    if (image_url) return;
    const a = $(fig).find("a.image").first();
    const href = a.attr("href");
    const img = $(fig).find("img").first();
    const imgSrc = img.attr("src") || img.attr("data-src");
    const candidate = href || imgSrc;
    if (
      candidate &&
      !/InvisibleHeroImage/i.test(candidate) &&
      candidate.includes("/gtawiki/images/")
    ) {
      image_url = stripFandomImageQuery(candidate);
    }
  });
  // Fallback: og:image if nothing else found. Reject known wiki-wide
  // placeholders (disambig pages fall back to Site-community-image / Site-logo).
  if (!image_url) {
    const ogImg = $('meta[property="og:image"]').attr("content");
    if (
      ogImg &&
      !/InvisibleHeroImage|Site-community-image|Site-logo|Wiki-wordmark/i.test(
        ogImg,
      )
    ) {
      image_url = stripFandomImageQuery(ogImg);
    }
  }

  const categories = new Set<string>();
  $('a[href^="/wiki/Category:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/\/wiki\/Category:([^?#]+)/);
    if (m) {
      const cat = decodeURIComponent(m[1]).replace(/_/g, " ");
      categories.add(cat);
    }
  });

  return {
    display_name,
    image_url,
    categories: Array.from(categories),
  };
}

function stripFandomImageQuery(url: string): string {
  const idx = url.indexOf("/revision/");
  return idx >= 0 ? url.slice(0, idx) : url.split("?")[0];
}

export function fandomPageUrl(slug: string): string {
  return `https://gta.fandom.com/wiki/${encodeURIComponent(slug.replace(/ /g, "_"))}`;
}

import { SITE_URL } from "./networks";

/** <meta name="fc:miniapp"> makes a shared link render as a card with a button in Base App. fc:frame keeps older clients working. */
export function miniAppEmbed({ imageUrl, title, url }: { imageUrl: string; title: string; url: string }) {
  const action = { name: "Backing", url, splashImageUrl: `${SITE_URL}/splash.png`, splashBackgroundColor: "#0b0d14" };
  const embed = (type: string) => JSON.stringify({ version: "1", imageUrl, button: { title, action: { type, ...action } } });
  return { "fc:miniapp": embed("launch_miniapp"), "fc:frame": embed("launch_frame") };
}

import ApifyScraperPage from './scraper/ApifyScraperPage'
import { TIKTOK_SCRAPER_CONFIG } from '../lib/scraper/configs'

export default function TikTokScraper() {
  return <ApifyScraperPage config={TIKTOK_SCRAPER_CONFIG} />
}

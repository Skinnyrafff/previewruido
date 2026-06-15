import ApifyScraperPage from './scraper/ApifyScraperPage'
import { INSTAGRAM_SCRAPER_CONFIG } from '../lib/scraper/configs'

export default function InstagramScraper() {
  return <ApifyScraperPage config={INSTAGRAM_SCRAPER_CONFIG} />
}

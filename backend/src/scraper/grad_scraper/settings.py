from src.core.config import get_settings

settings = get_settings()

BOT_NAME = "grad_scraper"
SPIDER_MODULES = ["grad_scraper.spiders"]
NEWSPIDER_MODULE = "grad_scraper.spiders"

# PROGRAM_URLS_FILE = settings.PROGRAM_URLS_FILE
# FACULTY_URLS_FILE = settings.FACULTY_URLS_FILE


DOWNLOAD_HANDLERS = {
    "http":  "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,
    "args": ["--no-sandbox", "--disable-dev-shm-usage"],
}


PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT = 30_000   # ms

DOWNLOAD_DELAY         = float(settings.DOWNLOAD_DELAY)
CONCURRENT_REQUESTS    = int(settings.CONCURRENT_REQUESTS)
CONCURRENT_REQUESTS_PER_DOMAIN = 2
AUTOTHROTTLE_ENABLED   = True
AUTOTHROTTLE_START_DELAY   = 2
AUTOTHROTTLE_MAX_DELAY     = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
RANDOMIZE_DOWNLOAD_DELAY = True

ROBOTSTXT_OBEY = True

RETRY_ENABLED  = True
RETRY_TIMES    = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

HTTPCACHE_ENABLED    = True
HTTPCACHE_EXPIRATION_SECS = 86_400   
HTTPCACHE_DIR        = ".scrapy_cache"
HTTPCACHE_IGNORE_HTTP_CODES = [503, 429]

DEFAULT_REQUEST_HEADERS = {
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

DOWNLOADER_MIDDLEWARES = {
    "scrapy.downloadermiddlewares.useragent.UserAgentMiddleware": None,
    "grad_scraper.middlewares.RandomUserAgentMiddleware": 400,
    "scrapy.downloadermiddlewares.retry.RetryMiddleware": 550,
}

ITEM_PIPELINES = {
    "grad_scraper.pipelines.cleaning.CleaningPipeline":         100,
    "grad_scraper.pipelines.elasticsearch.ElasticsearchPipeline": 300,
    "grad_scraper.pipelines.faculty_elasticsearch.FacultyElasticsearchPipeline": 350,
    "grad_scraper.pipelines.json_backup.JsonBackupPipeline":    400,
}

LOG_LEVEL  = settings.LOG_LEVEL
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"

FEEDS = {
    "output/raw_items.jsonl": {
        "format":   "jsonlines",
        "encoding": "utf8",
        "overwrite": False,
    },
}

FEED_EXPORT_ENCODING = "utf-8"

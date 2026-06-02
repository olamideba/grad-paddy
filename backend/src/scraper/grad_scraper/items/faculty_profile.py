import scrapy


class FacultyProfileItem(scrapy.Item):
    name             = scrapy.Field()   
    title            = scrapy.Field()   # "Andrew (1956) Professor of Electrical Engineering"
    university       = scrapy.Field()   # "MIT"
    department       = scrapy.Field()   # "EECS"
    program          = scrapy.Field()   # parent program this faculty belongs to
    source_url       = scrapy.Field()   # faculty profile page URL
    email            = scrapy.Field()   # extracted mailto: link
    research_areas   = scrapy.Field()   # raw text from profile page
    bio              = scrapy.Field()   # full bio text (up to 2000 chars)
    papers           = scrapy.Field()   # list of {title, year, citations, abstract, url}
    paper_keywords   = scrapy.Field()   # ["NLP", "wireless sensing", ...]
    fit_score        = scrapy.Field()   # 0–100
    fit_reasoning    = scrapy.Field()   # 2-3 sentence explanation
    conversation_angles = scrapy.Field()  # list of 3 specific talking points
    scraped_at        = scrapy.Field()
    papers_fetched_at = scrapy.Field()
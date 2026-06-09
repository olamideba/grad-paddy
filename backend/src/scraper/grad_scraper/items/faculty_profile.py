import scrapy


class FacultyProfileItem(scrapy.Item):
    name             = scrapy.Field()   
    title            = scrapy.Field()   
    university       = scrapy.Field()   
    department       = scrapy.Field()   
    program          = scrapy.Field()   
    source_url       = scrapy.Field()   
    email            = scrapy.Field()   
    research_areas   = scrapy.Field()   
    bio              = scrapy.Field()   
    papers           = scrapy.Field()   
    paper_keywords   = scrapy.Field()   
    fit_score        = scrapy.Field()   
    fit_reasoning    = scrapy.Field()   
    conversation_angles = scrapy.Field()  
    scraped_at        = scrapy.Field()
    papers_fetched_at = scrapy.Field()
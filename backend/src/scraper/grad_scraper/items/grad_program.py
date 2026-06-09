import scrapy


class GradProgramItem(scrapy.Item):
    raw_html   = scrapy.Field()
    university       = scrapy.Field()   # e.g. "MIT"
    program          = scrapy.Field()   # e.g. "PhD in Computer Science"
    department       = scrapy.Field()   # e.g. "EECS"
    source_url       = scrapy.Field()   # source URL
    requirements_url = scrapy.Field()
    deadline         = scrapy.Field()   # e.g. "December 15, 2024"
    deadline_type    = scrapy.Field()   # "hard" | "rolling" | "priority"
    funding          = scrapy.Field()   # full text description
    application_fee  = scrapy.Field()
    stipend_amount   = scrapy.Field()   # parsed dollar amount if found
    funding_years    = scrapy.Field()   # e.g. "5 years"
    research_focus   = scrapy.Field()   # free text: research areas / themes
    research_groups  = scrapy.Field()   # list of named groups/labs
    program_description = scrapy.Field()  # overview paragraph(s)
    semesters        = scrapy.Field() 
    requirements     = scrapy.Field()   # admission requirements text
    degree_length    = scrapy.Field()   # e.g. "4–6 years"
    scraped_at       = scrapy.Field()   # ISO timestamp
    raw_html_hash    = scrapy.Field()   # md5 of page HTML for change detection

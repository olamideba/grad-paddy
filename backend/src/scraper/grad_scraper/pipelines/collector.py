_collected_items = []

class CollectorPipeline:
    def __init__(self, bucket: list):
        self._bucket = bucket

    @classmethod
    def from_crawler(cls, crawler):
        # Scrapy instantiates via from_crawler — pass the shared list
        return cls(crawler.settings.get("_COLLECTOR_BUCKET"))

    def process_item(self, item, spider):
        self._bucket.append(dict(item))
        return item
"""
JsonBackupPipeline
──────────────────
Writes a local .jsonl backup of every scraped item, independent of ES.
Useful for debugging, re-indexing, or offline analysis.
"""

import json
import logging
from pathlib import Path
from itemadapter import ItemAdapter

logger = logging.getLogger(__name__)


class JsonBackupPipeline:
    def __init__(self):
        self.file = None

    def open_spider(self):
        Path("output").mkdir(exist_ok=True)
        self.file = open("output/scraped_items.jsonl", "a", encoding="utf-8")
        logger.info("JsonBackupPipeline: writing to output/scraped_items.jsonl")

    def close_spider(self):
        if self.file:
            self.file.close()

    def process_item(self, item):
        line = json.dumps(dict(ItemAdapter(item).asdict()), ensure_ascii=False, default=str)
        self.file.write(line + "\n")
        return item

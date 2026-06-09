"""
CleaningPipeline
────────────────
Normalises and validates item fields before they reach downstream pipelines.
"""

import re
import logging
from itemadapter import ItemAdapter
from grad_scraper.items.faculty_profile import FacultyProfileItem

logger = logging.getLogger(__name__)

# Collapse runs of whitespace (including newlines, tabs) to a single space
_WS = re.compile(r"\s+")


def _clean(text):
    if not text:
        return ""
    return _WS.sub(" ", str(text)).strip()


def _clean_list(lst):
    if not lst:
        return []
    return [_clean(x) for x in lst if x and _clean(x)]


class CleaningPipeline:
    TEXT_FIELDS = [
        "program", "department", "deadline", "deadline_type",
        "funding", "stipend_amount", "funding_years",
        "research_focus", "program_description",
        "requirements", "degree_length",
    ]
    LIST_FIELDS = ["research_groups"]

    def process_item(self, item):
        if isinstance(item, FacultyProfileItem):
            return item
            
        adapter = ItemAdapter(item)

        for field in self.TEXT_FIELDS:
            if adapter.get(field):
                adapter[field] = _clean(adapter[field])

        for field in self.LIST_FIELDS:
            if adapter.get(field):
                adapter[field] = _clean_list(adapter[field])

        # Clean faculty entries
        if adapter.get("faculty"):
            cleaned_faculty = []
            for f in adapter["faculty"]:
                cleaned_faculty.append({
                    "name":           _clean(f.get("name", "")),
                    "title":          _clean(f.get("title", "")),
                    "research_areas": _clean(f.get("research_areas", "")),
                    "bio_url":        f.get("bio_url", ""),
                    "bio":            _clean(f.get("bio", "")),
                })
            adapter["faculty"] = [f for f in cleaned_faculty if f["name"]]

        # replace the existing has_content check with this
        program = adapter.get("program", "").lower()
        source_url = adapter.get("source_url", "").lower()

        # drop if URL contains non-program patterns
        bad_url = any(kw in source_url for kw in [
            "/funding/", "/ta-", "/conditions", "/policy",
            "/faq", "/contact", "/news", "/events", "/forms",
            "/handbook", "/calendar", "/housing", "/visa",
        ])

        has_content = any([
            adapter.get("deadline"),
            adapter.get("research_focus"),
            adapter.get("faculty"),
            adapter.get("requirements"),
        ]) and not bad_url

        if not has_content:
            from scrapy.exceptions import DropItem
            raise DropItem(f"No meaningful content or non-program page: {adapter.get('url')}")

        return item

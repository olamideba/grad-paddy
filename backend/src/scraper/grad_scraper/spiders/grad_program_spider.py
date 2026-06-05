import asyncio
import json
import hashlib
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import scrapy
from scrapy_playwright.page import PageMethod

from src.core.config import get_settings
from grad_scraper.items.grad_program import GradProgramItem
from grad_scraper.items.faculty_profile import FacultyProfileItem

settings = get_settings()
logger = logging.getLogger(__name__)

# ── Regex patterns ────────────────────────────────────────────────────────────
DEADLINE_PATTERNS = [
    r"(?:application\s+)?deadline[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
    r"(?:due|submit\s+by)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
    r"(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})",
    r"(\d{1,2}/\d{1,2}/\d{4})",
    r"(\d{4}-\d{2}-\d{2})",
]

STIPEND_PATTERNS = [
    r"\$\s*([\d,]+)\s*(?:per\s+year|annually|/year)?",
    r"([\d,]+)\s*(?:USD|dollars)\s*(?:per\s+year|annually|stipend)",
]

FUNDING_KEYWORDS = [
    "fellowship", "stipend", "funding", "financial support",
    "tuition waiver", "research assistantship", "teaching assistantship",
    "RA", "TA", "fully funded", "financial aid",
]

PROGRAM_URL_KEYWORDS = ["/program", "/graduate", "/doctoral", "/phd", "/master", "/degree"]

NON_PROGRAM_URL_KEYWORDS = [
    "/funding/", "/financial", "/ta-", "/teaching-assistant",
    "/conditions", "/policy", "/policies", "/faq", "/faqs",
    "/contact", "/news", "/events", "/people", "/faculty",
    "/staff", "/research", "/about", "/resources", "/forms",
    "/handbook", "/calendar", "/visit", "/diversity", "/housing",
    "/visa", "/health", "/career", "/alumni", "/giving",
    "/materials", "/admission-process", "/community",
]


class GradProgramSpider(scrapy.Spider):
    name = "grad_program"
    custom_settings = {
        "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 60_000,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.program_urls_file = Path(
        kwargs.get("program_urls_file", "program_urls.txt")
        )
        self.faculty_urls_file = Path(
            kwargs.get("faculty_urls_file", "faculty_urls.txt")
        )

    async def _gemini_extract(self, response):
        import vertexai
        from vertexai.generative_models import GenerativeModel
        raw = response.css(
            "main *::text, article *::text, .content *::text, body *::text"
        ).getall()
        page_text = " ".join(t.strip() for t in raw if t.strip())
        page_text = re.sub(r"\s+", " ", page_text)[:8000]

        prompt = f"""You are extracting graduate program information from a university webpage.
            Extract the following fields and return ONLY a valid JSON object.
            Use empty string "" for any field not found on the page.
            Do not include markdown, backticks, or any text outside the JSON.

        {{
            "program": "full official degree program name",
            "department": "department or school name",
            "deadline": "application deadline date exactly as written",
            "deadline_type": "hard, rolling, or priority",
            "funding": "complete funding and stipend description",
            "stipend_amount": "numeric dollar amount only, no $ symbol",
            "funding_years": "number of years of guaranteed funding",
            "research_focus": "research areas and themes, 2-4 sentences",
            "research_groups": ["list", "of", "lab", "or", "group", "names"],
            "program_description": "program overview, 2-4 sentences",
            "requirements": "admission requirements summary",
            "degree_length": "typical program duration e.g. 4-6 years",
            "semesters": "which semesters intake happens e.g. Fall only",
            "application_fee": "numeric dollar amount only, no $ symbol"
        }}

        Page URL: {response.url}
        Page content:{page_text}"""

        try:
            vertexai.init(
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
            model  = GenerativeModel(settings.GEMINI_MODEL)
            result = await asyncio.to_thread(model.generate_content, prompt)
            raw    = result.text.strip()
            raw    = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(raw)
        except Exception as e:
            logger.warning(f"Gemini extraction failed for {response.url}: {e}")
            return {}


    async def start(self):
        print("DEBUG: start_requests called")
        print(f"DEBUG: faculty_urls_file = {self.faculty_urls_file}")
        print(f"DEBUG: exists = {self.faculty_urls_file.exists()}")
        if self.program_urls_file.exists():
            with open(self.program_urls_file) as f:
                program_urls = [
                    line.strip() for line in f
                    if line.strip() and not line.startswith("#")
                ]
            logger.info(f"Loaded {len(program_urls)} program URLs")
            for url in program_urls:
                yield self._make_request(url, callback=self.parse_entry_point)
        else:
            logger.warning(f"Program URLs file not found: {self.program_urls_file}")

        if self.faculty_urls_file.exists():
            with open(self.faculty_urls_file) as f:
                faculty_urls = [
                    line.strip() for line in f
                    if line.strip() and not line.startswith("#")
                ]
            logger.info(f"Loaded {len(faculty_urls)} faculty URLs")
            for url in faculty_urls:
                yield self._make_request(
                    url,
                    callback=self.parse_entry_point,
                    meta_extra={"is_faculty_directory": True}, 
                    use_playwright=False
                )
        else:
            logger.warning(f"Faculty URLs file not found: {self.faculty_urls_file}")

    def _make_request(self, url, callback, meta_extra=None, use_playwright=False):
        if use_playwright:
            meta = {
                "playwright": True,
                "playwright_include_page": True,
                "playwright_page_methods": [
                    PageMethod("route", "**/*google-analytics*", lambda route, _: route.abort()),
                    PageMethod("route", "**/*gtag*", lambda route, _: route.abort()),
                    PageMethod("wait_for_load_state", "domcontentloaded"), 
                    PageMethod("evaluate", "window.scrollTo(0, document.body.scrollHeight)"),
                    PageMethod("wait_for_timeout", 1500),
                ],
            }
        else:
            meta = {}
        if meta_extra:
            meta.update(meta_extra)
        return scrapy.Request(url, callback=callback, meta=meta, errback=self.handle_error)


    async def parse_entry_point(self, response):
        """
        Decides whether this URL is an index page (lists many programs)
        or a direct program page, and routes accordingly.
        """
        page = response.meta.get("playwright_page")
        try:
            is_faculty_page = (
                response.meta.get("is_faculty_directory", False)   
                or any(kw in response.url.lower() for kw in [    
                    "/people/", "/faculty/", "/faculty-advisors", "/role/faculty",  "/directory/faculty"
                ])
            )

            if is_faculty_page:
                logger.info(f"Faculty directory at {response.url}")
                faculty_links = self.find_faculty_links(response)
                for link_info in faculty_links[:50]:
                    yield self._make_request(
                        link_info["url"],
                        callback=self.parse_faculty_page,
                        meta_extra={"parent_item": {
                            "university":             self._infer_university(response.url),
                            "prefill_name":           link_info.get("name", ""),
                            "prefill_title":          link_info.get("title", ""),
                            "prefill_research_areas": link_info.get("research_areas", ""),
                            "prefill_email":          link_info.get("email", ""),
                        }}
                    )
                return 


            program_links = self._detect_program_links(response)

            if len(program_links) >= 3:
                logger.info(
                    f"Index page at {response.url} "
                    f"— found {len(program_links)} program links"
                )
                for link_info in program_links:
                    yield self._make_request(
                        link_info["url"],
                        callback=self.parse_program_page,
                        meta_extra={"index_deadline": link_info.get("deadline", "")}
                    )
            else:
                logger.info(f"Direct program page at {response.url}")
                async for item in self.parse_program_page(response):
                    yield item
                return

        finally:
            if page and not response.meta.get("_page_closed"):
                try:
                    await page.close()
                except Exception:
                    pass


    def _detect_program_links(self, response):
        """
        Finds program links on an index page.
        Tries three patterns in order: table → list → broad href match.
        Also captures deadline from the same row when available.
        """
        links = []
        base  = response.url

        oge_table = response.css("table.w-100")
        if oge_table:
            for row in oge_table.css("tbody tr"):
                name     = row.css("td:first-child a::text").get("").strip()
                href     = row.css("td:first-child a::attr(href)").get("").strip()
                deadline = row.css("td:last-child::text").get("").strip()
                if name and href:
                    links.append({
                        "url":      urljoin(base, href),
                        "name":     name,
                        "deadline": deadline,
                    })
            if links:
                logger.info(f"OGE-style table found — {len(links)} programs with deadlines")
                return links


        for table in response.css("table"):
            headers = [h.lower() for h in table.css("th::text").getall()]
            has_program_col = any(kw in " ".join(headers) for kw in ["program", "degree", "major"])

            if has_program_col:
                deadline_col_idx = next(
                    (i for i, h in enumerate(headers) if "deadline" in h), None
                )
                for row in table.css("tbody tr"):
                    cells    = row.css("td")
                    href     = row.css("td a::attr(href)").get("")
                    name     = row.css("td a::text").get("").strip()
                    deadline = ""
                    if deadline_col_idx is not None and len(cells) > deadline_col_idx:
                        deadline = cells[deadline_col_idx].css("::text").get("").strip()
                    if href and name:
                        links.append({
                            "url":      urljoin(base, href),
                            "name":     name,
                            "deadline": deadline,
                        })
        if links:
            return links

        for li in response.css("li"):
            href = li.css("a::attr(href)").get("")
            name = li.css("a::text").get("").strip()
            if (
                href and name 
                and any(kw in href.lower() for kw in PROGRAM_URL_KEYWORDS)
                and not any(kw in href.lower() for kw in NON_PROGRAM_URL_KEYWORDS)
            ):
                links.append({"url": urljoin(base, href), "name": name, "deadline": ""})
        if links:
            return links


        seen = set()
        for a in response.css("a"):
            href = a.attrib.get("href", "")
            name = a.css("::text").get("").strip()
            full = urljoin(base, href)
            if (
                full not in seen
                and urlparse(full).netloc == urlparse(base).netloc
                and any(kw in href.lower() for kw in PROGRAM_URL_KEYWORDS)
                and not any(kw in href.lower() for kw in NON_PROGRAM_URL_KEYWORDS)
                and len(name) > 4
            ):
                seen.add(full)
                links.append({"url": full, "name": name, "deadline": ""})

        return links



    async def parse_program_page(self, response):
        page = response.meta.get("playwright_page")
        try:
            item = GradProgramItem()
            item["source_url"] = response.url
            item["university"]    = self._infer_university(response.url)
            item["scraped_at"]    = datetime.now(timezone.utc).isoformat()
            item["raw_html_hash"] = hashlib.md5(response.text.encode()).hexdigest()

            item["program"] = self.extract_program_name(response)
            item["department"] = self.extract_department(response)
            item["deadline"] = (
                response.meta.get("index_deadline") 
                or self.extract_deadline(response)
            )
            item["semesters"]        = self.extract_semesters(response)
            item["application_fee"]  = self.extract_application_fee(response)
            item["requirements_url"] = self.extract_requirements_url(response)
            item["deadline_type"]       = self.infer_deadline_type(response)
            item["funding"]             = self.extract_funding_text(response)
            item["stipend_amount"]      = self.extract_stipend_amount(response)
            item["funding_years"]       = self.extract_funding_years(response)
            item["research_focus"]      = self.extract_research_focus(response)
            item["research_groups"]     = self.extract_research_groups(response)
            item["program_description"] = self.extract_program_description(response)
            item["requirements"]        = self.extract_requirements(response)
            item["degree_length"]       = self.extract_degree_length(response)


            if "oge.mit.edu" in response.url:
                oge_data = self.extract_oge_fields(response)
                for field, value in oge_data.items():
                    if value and not item.get(field): 
                        item[field] = value


            critical_empty = not any([
                item.get("deadline"),
                item.get("funding"),
                item.get("research_focus"),
                item.get("requirements"),
            ])

            if critical_empty and settings.GEMINI_ENABLED.lower() == "true":
                logger.info(f"Heuristics incomplete — calling Gemini for {response.url}")
                gemini_data = await self._gemini_extract(response)
                for field, value in gemini_data.items():
                    if value and not item.get(field):
                        item[field] = value

            yield item

            for link_info in self.find_faculty_links(response)[:10]:
                url = link_info["url"] if isinstance(link_info, dict) else link_info
                meta = {"parent_item": dict(item)}
                if isinstance(link_info, dict):
                    meta["parent_item"].update({
                        "prefill_name":           link_info.get("name", ""),
                        "prefill_title":          link_info.get("title", ""),
                        "prefill_research_areas": link_info.get("research_areas", ""),
                        "prefill_email":          link_info.get("email", ""),
                    })
                yield self._make_request(url, callback=self.parse_faculty_page, meta_extra=meta)

        finally:
            if page:
                response.meta["_page_closed"] = True
                await page.close()

    async def parse_faculty_page(self, response):
        page   = response.meta.get("playwright_page")
        parent = response.meta.get("parent_item", {})
        try:
            item = FacultyProfileItem()
            item["name"]               = parent.get("prefill_name", "") or self._extract_text(response, ["h1"])
            item["title"]              = parent.get("prefill_title", "") or self._extract_text(response, [".title", ".position"])
            item["email"]              = parent.get("prefill_email", "") or response.css("a[href^='mailto']::attr(href)").get("").replace("mailto:", "")
            item["research_areas"]     = parent.get("prefill_research_areas", "")
            item["bio"]                = self._extract_paragraphs(response, max_chars=2000)
            item["source_url"]         = response.url
            item["university"]         = parent.get("university", self._infer_university(response.url))
            item["program"]            = parent.get("program", "")
            item["scraped_at"]         = datetime.now(timezone.utc).isoformat()
            item["papers"]             = []
            item["paper_keywords"]     = []
            item["fit_score"]          = 0
            item["fit_reasoning"]      = ""
            item["conversation_angles"] = []
            print(f"DEBUG: yielding item for {response.url}")
            yield item
        finally:
            if page:
                await page.close()


    def extract_program_name(self, response):
        for candidate in [
            response.css("h1::text").get(""),
            response.css("title::text").get(""),
            response.css(".program-title::text").get(""),
            response.css(".page-title::text").get(""),
        ]:
            if candidate and len(candidate.strip()) > 3:
                return candidate.strip()
        return ""

    def extract_department(self, response):
        for sel in [".department::text", ".dept::text",
                    "header .subtitle::text", ".breadcrumb li:last-child::text"]:
            val = response.css(sel).get()
            if val:
                return val.strip()
        parts = [p for p in urlparse(response.url).path.split("/") if p]
        return parts[0].replace("-", " ").title() if parts else ""


    def _oge_labeled_field(self, response, label):
        """Gets the value next to a bold label like 'Fee:' or 'Deadline:'"""
        value = response.xpath(
            f"//strong[contains(text(),'{label}')]/following-sibling::text()[1]"
        ).get("")
        if value.strip():
            return value.strip()
        value = response.xpath(
            f"//strong[contains(text(),'{label}')]/../following-sibling::*[1]//text()"
        ).get("")
        return value.strip()
    
    def extract_oge_fields(self, response):
        """
        Extracts all fields from oge.mit.edu program pages.
        Uses accordion button labels to find sections — works for all 47 programs.
        """
        result = {}

        def get_accordion_body(label):
            for btn in response.css("button.btn-link"):
                if label.lower() in btn.css("::text").get("").lower():
                    target = btn.attrib.get("data-target", "").lstrip("#")
                    if target:
                        return response.css(f"#{target} .accordion-body")
            return None

        for strong in response.css("strong"):
            if "deadline" in strong.css("::text").get("").lower():
                value = strong.xpath("following-sibling::text()[1]").get("")
                if value.strip():
                    result["deadline"] = self._oge_labeled_field(response, "Deadline")
                break

        for strong in response.css("strong"):
            if strong.css("::text").get("").strip().lower() == "fee:":
                value = strong.xpath("../following-sibling::*[1]//text()").get("")
                if not value:
                    value = strong.xpath("following-sibling::text()[1]").get("")
                if value.strip():
                    result["application_fee"] = self._oge_labeled_field(response, "Fee").replace("$", "").replace(".00", "").strip()
                break

        body = get_accordion_body("Entry Term")
        if body:
            terms = [t.strip() for t in body.css("*::text").getall() if t.strip()]
            result["semesters"] = ", ".join(terms)

        body = get_accordion_body("Degrees")
        if body:
            degrees = [t.strip() for t in body.css("h2::text, h3::text").getall() if t.strip()]
            result["degree_length"] = ", ".join(degrees)

        body = get_accordion_body("Areas of Research")
        if body:
            areas = [t.strip() for t in body.css("li::text").getall() if t.strip()]
            result["research_focus"]  = ", ".join(areas)
            result["research_groups"] = areas

        body = get_accordion_body("Application Requirements")
        if body:
            reqs = [t.strip() for t in body.css("*::text").getall() if t.strip()]
            result["requirements"] = " ".join(reqs)

        body = get_accordion_body("Financial Support")
        if body:
            funding_texts = [t.strip() for t in body.css("*::text").getall() if t.strip()]
            result["funding"] = " ".join(funding_texts)

        return result

    def extract_deadline(self, response):
        structured = response.css(
            '[class*="deadline"]::text, [id*="deadline"]::text, time::attr(datetime)'
        ).getall()
        if structured:
            return structured[0].strip()

        for table in response.css("table"):
            headers = [h.lower() for h in table.css("th::text").getall()]
            idx = next((i for i, h in enumerate(headers) if "deadline" in h), None)
            if idx is not None:
                val = table.css(f"td:nth-child({idx + 1})::text").get("")
                if val.strip():
                    return val.strip()

        full_text = " ".join(response.css("*::text").getall())
        for pattern in DEADLINE_PATTERNS:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    def infer_deadline_type(self, response):
        text = " ".join(response.css("*::text").getall()).lower()
        if "rolling" in text:
            return "rolling"
        if "priority" in text and "deadline" in text:
            return "priority"
        return "hard"

    def extract_funding_text(self, response):
        funding_paras = [
            p.strip() for p in response.css("p::text, li::text").getall()
            if any(kw in p.lower() for kw in FUNDING_KEYWORDS)
        ]
        return " ".join(funding_paras[:5]) if funding_paras else ""

    def extract_stipend_amount(self, response):
        text = " ".join(response.css("*::text").getall())
        for pattern in [
            r"stipend[^\$]*\$\s*([\d,]+)",
            r"\$\s*([\d,]+)\s*(?:per\s+year|annually|/year)",
            r"([\d,]+)\s*(?:USD|dollars)\s*(?:per\s+year|annually)",
        ]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount = match.group(1).replace(",", "")
                if 5000 <= int(amount) <= 100000:
                    return amount
        return ""


    def extract_funding_years(self, response):
        text  = " ".join(response.css("*::text").getall())
        match = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*years?", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}–{match.group(2)} years"
        match = re.search(r"(\d+)\s*years?\s+(?:of\s+)?(?:funding|support|guarantee)", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)} years"
        return ""

    def extract_research_focus(self, response):
        text_blocks = []
        for section in response.css("section, div, article"):
            heading = section.css("h2::text, h3::text").get("").lower()
            if any(kw in heading for kw in ["research", "focus", "area", "interest", "group"]):
                block = " ".join(section.css("*::text").getall()).strip()
                if len(block) > 50:
                    text_blocks.append(block)
        return " ".join(text_blocks[:3]) if text_blocks else ""

    def extract_research_groups(self, response):
        groups = []
        for el in response.css("a, li, h3, h4"):
            text  = el.css("::text").get("").strip()
            lower = text.lower()
            if any(kw in lower for kw in ["lab", "group", "center", "institute", "laboratory"]):
                if 3 < len(text) < 100:
                    groups.append(text)
        return list(dict.fromkeys(groups))[:20]

    def extract_program_description(self, response):
        paras = []
        for p in response.css("main p, article p, .content p, .program-overview p"):
            text = " ".join(p.css("::text").getall()).strip()
            if len(text) > 80:
                paras.append(text)
            if len(paras) >= 5:
                break
        return " ".join(paras)

    def extract_requirements(self, response):
        for section in response.css("section, div"):
            heading = section.css("h2::text, h3::text").get("").lower()
            if any(kw in heading for kw in ["requirement", "admission", "eligibility", "apply"]):
                return " ".join(section.css("*::text").getall()).strip()[:3000]
        return ""

    def extract_degree_length(self, response):
        text  = " ".join(response.css("*::text").getall())
        match = re.search(
            r"(?:program\s+)?(?:takes?|lasts?|duration[:\s]+)\s*(\d+\s*[-–to]+\s*\d+\s*years?|\d+\s*years?)",
            text, re.IGNORECASE
        )
        return match.group(1).strip() if match else ""

    def extract_faculty(self, response):
        faculty_list = []
        for card in response.css(
            ".faculty-card, .person-card, .faculty-member, "
            ".faculty-item, .people-card, [class*='faculty'], [class*='professor']"
        ):
            name    = card.css("h2::text, h3::text, h4::text, .name::text, strong::text").get("").strip()
            title   = card.css(".title::text, .position::text, .role::text, em::text").get("").strip()
            areas   = ", ".join(t.strip() for t in card.css(".research::text, .interests::text, .areas::text").getall())
            bio_url = card.css("a::attr(href)").get("")
            if bio_url:
                bio_url = urljoin(response.url, bio_url)
            if name:
                faculty_list.append({"name": name, "title": title,
                                     "research_areas": areas, "bio_url": bio_url})
        return faculty_list

    def find_faculty_links(self, response):
        links = []
        base = response.url

        cards = response.css("div.people-entry")
        if cards:
            for card in cards:
                href  = card.css("a.people-index-image::attr(href)").get("")
                name  = card.css("h5 a::text, h5::text").get("").strip()
                title = card.css("p::text").get("").strip()
                areas = card.css("div.people-research a::text").getall()
                email = card.css("a[href^='mailto']::attr(href)").get("").replace("mailto:", "")
                if href and name:
                    links.append({
                        "url":            urljoin(base, href),
                        "name":           name,
                        "title":          title,
                        "research_areas": ", ".join(areas),
                        "email":          email,
                    })
            logger.info(f"MIT EECS people page — found {len(links)} faculty")
            return links

        for a in response.css("a"):
            text = a.css("::text").get("").lower()
            href = a.attrib.get("href", "")
            if any(kw in text or kw in href.lower() for kw in ["faculty", "people", "professors", "staff"]):
                full = urljoin(response.url, href)
                if urlparse(full).netloc == urlparse(response.url).netloc:
                    links.append(full)
        return list(dict.fromkeys(links))


    def extract_semesters(self, response):
        text = " ".join(response.css("*::text").getall()).lower()

        semesters = []
        if "fall" in text:
                semesters.append("Fall")
        if "spring" in text:
            semesters.append("Spring")
        if "summer" in text:
            semesters.append("Summer")

        match = re.search(
            r"(fall|spring|summer)\s+(?:only|admission|intake|semester|term)",
            text, re.IGNORECASE
        )
        if match:
            return match.group(1).title() + " only"

        return ", ".join(semesters) if semesters else ""

    def extract_application_fee(self, response):
        text = " ".join(response.css("*::text").getall())
        match = re.search(
            r"\$\s*(\d+)\s*(?:application\s+)?fee|fee\s+(?:of\s+)?\$\s*(\d+)",
            text, re.IGNORECASE
        )
        if match:
            return match.group(1) or match.group(2)
        return ""

    def extract_requirements_url(self, response):
        for a in response.css("a"):
            text = a.css("::text").get("").lower()
            href = a.attrib.get("href", "")
            if any(kw in text or kw in href.lower() for kw in [
            "requirement", "admission", "how-to-apply", "apply-now"
            ]):
                return urljoin(response.url, href)
        return ""


    def _infer_university(self, url):
        domain = urlparse(url).netloc.lower()
        domain = re.sub(r"^www\.", "", domain)
        parts  = domain.split(".")
        return parts[-2].upper() if len(parts) >= 2 else domain

    def _extract_text(self, response, selectors):
        for sel in selectors:
            val = response.css(f"{sel}::text").get()
            if val:
                return val.strip()
        return ""

    def _extract_paragraphs(self, response, max_chars=2000):
        texts = []
        total = 0
        for p in response.css("p::text, p *::text"):
            t = (p.get() or "").strip()
            if t:
                texts.append(t)
                total += len(t)
                if total > max_chars:
                    break
        return " ".join(texts)

    def _extract_list_items(self, response, keywords=None):
        items = []
        for li in response.css("li::text").getall():
            li = li.strip()
            if keywords:
                if any(kw in li.lower() for kw in keywords) or len(li) < 80:
                    items.append(li)
            else:
                items.append(li)
        return items[:20]

    def handle_error(self, failure):
        logger.error(f"Request failed: {failure.request.url} — {failure.value}")

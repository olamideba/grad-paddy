"""
ingestion_service.py
─────────────────────
ADK tool for scraping a URL and indexing it into ES.

Supports two URL types:
  "program" → scrapes program info → indexes into grad-programs
  "faculty" → scrapes faculty directory → indexes into faculty-profiles
"""

import logging
import asyncio
import tempfile
from datetime import datetime, timezone
from src.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class IngestionService:

    @staticmethod
    async def ingest_url(
        url:      str,
        url_type: str,
    ) -> dict:
        """
        Scrape a URL and index its content into Elasticsearch.
        Use this when the student provides a new program or faculty URL
        that isn't already in the database.

        Args:
            url:      The program or faculty directory URL to scrape.
                  e.g. "https://oge.mit.edu/programs/eecs/"
            url_type: "program" for grad program pages,
                  "faculty" for faculty directory pages.

        Returns:
            Dict with status, chunks_indexed, and a summary of what was found.
        """
        logger.info(f"ingest_url called: {url} ({url_type})")

        try:
            # ── Step 1: Scrape ────────────────────────────────────────────────
            logger.info(f"Scraping {url}...")
            items = await _scrape_single_url(url, url_type)

            if not items:
                return {
                    "status":  "failed",
                    "message": f"No content found at {url}. "
                        f"Check the URL is accessible and contains grad program info.",
                    "chunks_indexed": 0,
                }
            logger.info(f"Scraped {len(items)} items from {url}")

            # ── Step 2: Chunk + embed + index ─────────────────────────────────
            logger.info("Indexing into Elasticsearch...")
            result = await _index_items(items)

            return {
                "status":         "complete",
                "url":            url,
                "url_type":       url_type,
                "items_scraped":  len(items),
                "chunks_indexed": result["chunks_indexed"],
                "programs_found": result.get("programs_found", []),
                "faculty_found":  result.get("faculty_found", []),
                "message":        (
                    f"Successfully indexed {result['chunks_indexed']} chunks "
                    f"from {url}. You can now search for this content."
                ),
            }

        except Exception as e:
            logger.error(f"ingest_url failed for {url}: {e}")
            return {
                "status":  "failed",
                "message": str(e),
                "chunks_indexed": 0,
            }

    @staticmethod
    async def check_url_indexed(url: str) -> dict:
        """
        Check if a URL has already been indexed in ES.
        Call this before ingest_url to avoid re-scraping.

        Args:
            url: The URL to check.

        Returns:
            Dict with 'indexed' bool and 'chunks' count if found.
        """
        try:
            from elasticsearch import AsyncElasticsearch

            es       = AsyncElasticsearch(
                settings.ES_URL,
                api_key=settings.ELASTIC_API_KEY,
            )

            try:
                # Check grad-programs index
                prog_resp = await es.count(
                    index=settings.PROGRAM_ES_INDEX,
                    body={"query": {"term": {"source_url": url}}},
                )

                # Check faculty-profiles index
                fac_resp = await es.count(
                    index=settings.FACULTY_ES_INDEX,
                    body={"query": {"term": {"source_url": url}}},
                )

                total = prog_resp["count"] + fac_resp["count"]

                return {
                    "indexed": total > 0,
                    "chunks":  total,
                    "url":     url,
                }
            finally:
                await es.close()

        except Exception as e:
            logger.error(f"check_url_indexed failed: {e}")
            return {"indexed": False, "chunks": 0, "url": url}


    @staticmethod
    async def _scrape_single_url(url: str, url_type: str) -> list:
        """Run Scrapy spider for a single URL, return collected items."""

        def _run_scrapy():
            import scrapy.crawler as crawler_module
            from scrapy.utils.project import get_project_settings
            from src.scraper.grad_scraper.spiders.grad_program_spider import GradProgramSpider

            collected_items = []

            # Write URL to temp file
            tmp = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False
            )
            tmp.write(url + "\n")
            tmp.close()
            tmp_path = tmp.name

            # Override settings — collect items in memory, skip ES pipeline
            settings = get_project_settings()
            settings.set("ITEM_PIPELINES", {
                "src.scraper.grad_scraper.pipelines.cleaning.CleaningPipeline": 100,
            })
            settings.set("LOG_LEVEL", "WARNING")  # reduce noise
            settings.set("CLOSESPIDER_ITEMCOUNT", 0)  # no limit

            # Collect items via custom pipeline
            class _CollectorPipeline:
                def process_item(self, item, spider):
                    collected_items.append(dict(item))
                    return item

            settings.set("ITEM_PIPELINES", {
                "src.scraper.grad_scraper.pipelines.cleaning.CleaningPipeline": 100,
                "__main__._CollectorPipeline": 200,
            })

            process = crawler_module.CrawlerProcess(settings)

            if url_type == "faculty":
                process.crawl(
                    GradProgramSpider,
                    program_urls_file="/dev/null",
                    faculty_urls_file=tmp_path,
                )
            else:
                process.crawl(
                    GradProgramSpider,
                    program_urls_file=tmp_path,
                    faculty_urls_file="/dev/null",
                )

            process.start()

            # Cleanup temp file
            import os
            os.unlink(tmp_path)

            return collected_items

        return await asyncio.to_thread(_run_scrapy)


    @staticmethod
    async def _index_items(items: list) -> dict:
        """Run chunking + embedding + indexing on scraped items."""

        def _run_indexing():
            from src.scraper.grad_scraper.pipelines.elasticsearch import ElasticsearchPipeline
            from src.scraper.grad_scraper.pipelines.faculty_elasticsearch import FacultyElasticsearchPipeline
            from src.scraper.grad_scraper.items.faculty_profile import FacultyProfileItem

            program_pipeline = ElasticsearchPipeline()
            faculty_pipeline = FacultyElasticsearchPipeline()

            class _FakeSpider:
                name = "ingestion_tool"

            spider = _FakeSpider()
            program_pipeline.open_spider(spider)
            faculty_pipeline.open_spider(spider)

            programs_found = []
            faculty_found  = []
            chunks_indexed = 0

            for item in items:
                # Route to correct pipeline by item type
                if isinstance(item, dict) and "name" in item and "email" in item:
                    # Faculty item
                    faculty_pipeline.process_item(item, spider)
                    faculty_found.append(item.get("name", ""))
                else:
                    # Program item
                    program_pipeline.process_item(item, spider)
                    prog_name = item.get("program", "")
                    if prog_name:
                        programs_found.append(prog_name)

                chunks_indexed += 1

            program_pipeline.close_spider(spider)
            faculty_pipeline.close_spider(spider)

            return {
                "chunks_indexed": chunks_indexed,
                "programs_found": list(set(programs_found)),
                "faculty_found":  list(set(faculty_found)),
            }

        return await asyncio.to_thread(_run_indexing)
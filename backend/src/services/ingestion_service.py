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
        url_type: str
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
            logger.info(f"Scraping {url}...")
            items = await IngestionService._scrape_single_url(url, url_type)

            if not items:
                return {
                    "status":  "failed",
                    "message": f"No content found at {url}. "
                        f"Check the URL is accessible and contains grad program info.",
                    "chunks_indexed": 0,
                }
            logger.info(f"Scraped {len(items)} items from {url}")

            logger.info("Indexing into Elasticsearch...")
            result = await IngestionService._index_items(items)

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
                    body={"query": {"prefix": {"source_url": url}}},
                )

                # Check faculty-profiles index
                fac_resp = await es.count(
                    index=settings.FACULTY_ES_INDEX,
                    body={"query": {"prefix": {"source_url": url}}},
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
        import json
        import subprocess
        import tempfile
        import os

        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
        tmp.write(url + "\n")
        tmp.close()
        tmp_path = tmp.name

        # Output file for scraped items
        output_file = tempfile.NamedTemporaryFile(
            suffix=".json", delete=False
        )
        output_file.close()
        output_path = output_file.name

        try:
            if url_type == "faculty":
                args = [
                    "scrapy", "crawl", "grad_program",
                    "-a", f"faculty_urls_file={tmp_path}",
                    "-a", "program_urls_file=/dev/null",
                    "-o", output_path,
                ]
            else:
                args = [
                    "scrapy", "crawl", "grad_program",
                    "-a", f"program_urls_file={tmp_path}",
                    "-a", "faculty_urls_file=/dev/null",
                    "-o", output_path,
                ]
            proc = await asyncio.create_subprocess_exec(
                *args,
                cwd=os.path.abspath("/app/src/scraper"), 
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                logger.error(f"Scrapy process failed: {stderr.decode()}")
                return []

            # Read scraped items from output file
            with open(output_path, "r") as f:
                items = json.load(f)

            return items

        except Exception as e:
            logger.error(f"_scrape_single_url failed: {e}")
            return []

        finally:
            os.unlink(tmp_path)
            if os.path.exists(output_path):
                os.unlink(output_path)


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
    
    @staticmethod
    async def ingest_url_background(url: str, url_type: str, user_id: str) -> dict:
        """Start ingestion as a background task, persist job to Firestore."""
        from src.repositories.ingestion_repo import IngestionRepository

        job = await IngestionRepository.create_job(user_id, url, url_type)
        job_id = job["id"]

        asyncio.create_task(
            IngestionService._run_ingestion(job_id, url, url_type, user_id)
        )

        return {
            "status":  "started",
            "job_id":  job_id,
            "message": f"Ingestion started in the background. Job ID: {job_id}",
        }

    @staticmethod
    async def _run_ingestion(job_id: str, url: str, url_type: str, user_id: str):
        """Background task — updates Firestore when done."""
        from src.repositories.ingestion_repo import IngestionRepository
        try:
            result = await IngestionService.ingest_url(url, url_type)


            check = await IngestionService.check_url_indexed(url)
            chunks_indexed = check.get("chunks", 0)

            await IngestionRepository.complete_job(
                user_id, job_id, chunks_indexed
            )
            logger.info(f"Background ingestion complete: {job_id}")
        except Exception as e:
            await IngestionRepository.fail_job(user_id, job_id, str(e))
            logger.error(f"Background ingestion failed: {job_id} — {e}")

    @staticmethod
    async def get_ingestion_status(user_id: str, job_id: str) -> dict:
        """Check job status from Firestore."""
        from src.repositories.ingestion_repo import IngestionRepository
        job = await IngestionRepository.get_job(user_id, job_id)
        if not job:
            return {"status": "not_found", "job_id": job_id}
        return job
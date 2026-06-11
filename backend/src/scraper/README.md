# Grad Program Scraper

Scrapes university graduate program pages for **deadlines, funding, faculty, and research focus**, chunks and embeds the content, then indexes it into **Elasticsearch** for hybrid keyword + semantic search.

## Stack

| Layer | Tool |
|---|---|
| Scraping engine | Scrapy |
| JS rendering | Playwright (via scrapy-playwright) |
| Chunking | LangChain RecursiveCharacterTextSplitter |
| Embeddings | Gemini `text-embedding-004` |
| Vector store | Elasticsearch 8+ (kNN + BM25 hybrid) |

## Project Structure

```
grad_scraper/
├── grad_scraper/
│   ├── spiders/
│   │   └── grad_program_spider.py   # Main spider + faculty page parser
│   ├── pipelines/
│   │   ├── cleaning.py              # Normalise & validate items
│   │   ├── elasticsearch.py         # Chunk → embed → index
│   │   └── json_backup.py           # Local .jsonl backup
│   ├── items/
│   │   └── grad_program.py          # Item schema
│   ├── middlewares.py               # Random user-agent rotation
│   └── settings.py                  # All Scrapy + pipeline config
├── query.py                         # CLI search tool
├── urls.txt                         # Input URLs (one per line)
├── .env.example                     # Config template
└── requirements.txt
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
playwright install chromium
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Elasticsearch host and preferred embedding backend
```

### 3. Start Elasticsearch

```bash
# Docker (quickest)
docker run -d --name es -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0
```

### 4. Add your URLs

Edit `urls.txt` — one graduate program URL per line. Comments start with `#`.

```
# MIT EECS
https://www.eecs.mit.edu/academics-admissions/graduate-program/
```

## Running the scraper

```bash
scrapy crawl grad_program
```

Scrapy will:
1. Fetch each URL with Playwright (handles JS rendering)
2. Extract structured fields + free text
3. Clean and validate each item
4. Chunk text → generate embeddings → bulk-index into Elasticsearch
5. Save a local backup to `output/scraped_items.jsonl`

## Searching the index

```bash
# Hybrid search (recommended)
python query.py "NLP for healthcare faculty Toronto"

# Semantic only (finds conceptually similar content)
python query.py "machine learning systems research" --mode semantic

# Keyword only (fast, exact/fuzzy match)
python query.py "December deadline funded PhD CS" --mode keyword

# More results
python query.py "computer vision robotics" --top 10
```

## Extracted fields

| Field | Type | Description |
|---|---|---|
| `university` | keyword | Inferred from domain (e.g. MIT) |
| `program` | text | Program name from `<h1>` |
| `department` | keyword | Department/school name |
| `deadline` | text | Application deadline date |
| `deadline_type` | keyword | hard / rolling / priority |
| `funding` | text | Funding description (chunked) |
| `stipend_amount` | keyword | Parsed dollar amount |
| `funding_years` | keyword | e.g. "5 years" |
| `research_focus` | text | Research areas (chunked) |
| `research_groups` | keyword[] | Named labs/groups |
| `program_description` | text | Overview paragraphs (chunked) |
| `requirements` | text | Admission requirements (chunked) |
| `degree_length` | keyword | e.g. "4–6 years" |
| `faculty` | nested | name, title, research_areas, bio_url |

## Embedding backends

**Local (default)** — `all-MiniLM-L6-v2`, 384 dims, free, runs on CPU.
Set `EMBEDDING_BACKEND=local` in `.env`.

**OpenAI** — `text-embedding-3-small`, 1536 dims, better quality, requires API key.
Set `EMBEDDING_BACKEND=openai` and `OPENAI_API_KEY=sk-...` in `.env`.

## Adding a custom spider for a specific school

```python
# grad_scraper/spiders/mit_spider.py
from .grad_program_spider import GradProgramSpider

class MITSpider(GradProgramSpider):
    name = "mit"
    start_urls = ["https://www.eecs.mit.edu/academics-admissions/graduate-program/"]

    def extract_deadline(self, response):
        # MIT puts deadlines in a custom widget
        return response.css(".admissions-date::text").get("").strip()
```

## Tips

- **Rate limiting**: `DOWNLOAD_DELAY` defaults to 2s. Increase for stricter schools.
- **PDF links**: If a program embeds deadlines/funding in PDFs, add `pdfplumber` extraction in the spider's `parse_program_page` method.
- **Re-indexing**: Delete the index and re-run. The ES pipeline recreates it automatically.
  ```bash
  curl -X DELETE http://localhost:9200/grad-programs
  scrapy crawl grad_program
  ```
- **Cache**: Scrapy caches responses for 24h by default. Delete `.scrapy_cache/` to force a fresh crawl.

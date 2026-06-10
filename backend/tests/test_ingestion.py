# import asyncio
# import sys
# import os
# import time
# import importlib.util

# sys.path.insert(0, os.path.abspath("."))

# # Load ingestion_service directly, bypassing src/services/__init__.py
# spec = importlib.util.spec_from_file_location(
#     "ingestion_service",
#     os.path.abspath("src/services/ingestion_service.py")
# )
# mod = importlib.util.module_from_spec(spec) 
# spec.loader.exec_module(mod)                
# IngestionService = mod.IngestionService

# async def main():
#     url = "https://steinhardt.nyu.edu/about/faculty"
#     url_type = "faculty"
    
#     # print("Checking if already indexed...")
#     # t0 = time.perf_counter()
#     # check = await IngestionService.check_url_indexed(url)
#     # print(f"Check result: {check} ({time.perf_counter() - t0:.2f}s)")
    
#     print("\nRunning ingestion...")
#     t0 = time.perf_counter()
#     result = await IngestionService.ingest_url(url, url_type)
#     print(f"Ingestion result: {result} ({time.perf_counter() - t0:.2f}s)")

# asyncio.run(main())


# test_ingestion.py
import asyncio
import os
import json
import time

async def main():
    url = "https://steinhardt.nyu.edu/about/faculty"
    
    import tempfile
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
    tmp.write(url + "\n")
    tmp.close()

    output = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    output.close()

    print("Running scrapy...")
    t0 = time.perf_counter()

    proc = await asyncio.create_subprocess_exec(
        "scrapy", "crawl", "grad_program_spider",
        "-a", f"faculty_urls_file={tmp.name}",
        "-a", "program_urls_file=/dev/null",
        "-o", output.name,
        "-t", "json",
        cwd=os.path.abspath("src/scraper"),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await proc.communicate()
    print(f"Done in {time.perf_counter() - t0:.2f}s")
    print("Return code:", proc.returncode)

    if proc.returncode != 0:
        print("STDERR:", stderr.decode())
    else:
        with open(output.name) as f:
            items = json.load(f)
        print(f"Items scraped: {len(items)}")
        if items:
            print("Sample:", items[0])

    os.unlink(tmp.name)
    os.unlink(output.name)

asyncio.run(main())
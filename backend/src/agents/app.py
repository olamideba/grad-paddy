import warnings

from google.adk.agents.context_cache_config import ContextCacheConfig
from google.adk.apps import App
from google.adk.apps._configs import EventsCompactionConfig
from google.adk.apps.llm_event_summarizer import LlmEventSummarizer
from google.adk.models.registry import LLMRegistry

from src.agents.root import root_agent

# gemini-3.1-flash-lite: cheapest non-deprecated Gemini model, adequate for
# conversation summarisation (no deep reasoning needed here).
_summarizer = LlmEventSummarizer(llm=LLMRegistry.new_llm("gemini-3.1-flash-lite"))

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    _compaction_config = EventsCompactionConfig(
        summarizer=_summarizer,
        compaction_interval=5,
        overlap_size=1,
        token_threshold=40_000,
        event_retention_size=3,
    )

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    _cache_config = ContextCacheConfig(
        cache_intervals=10,
        ttl_seconds=1800,
        min_tokens=4096,
    )

grad_paddy_app = App(
    name="grad_paddy",
    root_agent=root_agent,
    events_compaction_config=_compaction_config,
    context_cache_config=_cache_config,
)

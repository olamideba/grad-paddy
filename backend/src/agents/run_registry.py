# shared in-memory store of {thread_id: asyncio.Task}
import asyncio

_registry: dict[str, asyncio.Task] = {}


def register(thread_id: str, task: asyncio.Task) -> None:
    _registry[thread_id] = task


def deregister(thread_id: str) -> None:
    _registry.pop(thread_id, None)


def cancel(thread_id: str) -> bool:
    task = _registry.get(thread_id)
    if task and not task.done():
        task.cancel()
        return True
    return False

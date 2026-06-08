from collections.abc import Callable

_registry: dict[str, Callable[[], None]] = {}


def register(thread_id: str, cancel_fn: Callable[[], None]) -> None:
    _registry[thread_id] = cancel_fn


def deregister(thread_id: str) -> None:
    _registry.pop(thread_id, None)


def cancel(thread_id: str) -> bool:
    cancel_fn = _registry.get(thread_id)
    if cancel_fn:
        cancel_fn()
        return True
    return False

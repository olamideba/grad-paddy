"""Regression tests for the single HITL approval -> persistence path.

Production bugs this locks down:
  1. Approved CREATE (e.g. a tracker application) looked approved but never
     persisted — a brittle `university && program` field guard silently dropped
     it. _apply_change must attempt the write from the payload, no silent guard.
  2. Approved UPDATE / DELETE were delegated back to the agent, whose re-call was
     blocked by the safety callback, so they never applied. They now persist
     server-side via the same single path.
  3. Under auto_approve, irreversible deletes bypassed the gate entirely. The
     safety callback must still force deletes through the gate.

One gate (request_hitl) -> one persistence dispatch (_apply_change).
"""

from types import SimpleNamespace

import pytest

import src.services.tracker_service as tracker_mod
import src.services.shortlist_service as shortlist_mod
import src.services.drafts_service as drafts_mod
import src.services.users_service as users_mod
from src.services.hitl_service import HITLService
from src.agents import callbacks as cb


class _Recorder:
    def __init__(self, result=None):
        self.calls = []
        self.result = result

    async def __call__(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.result


def _rec(entity, action, ref_id=None, content=None, **fields):
    payload = {"entity": entity, "action": action, "fields": fields}
    if ref_id is not None:
        payload["ref_id"] = ref_id
    if content is not None:
        payload["content"] = content
    return {"id": "hitl_1", "payload": payload}


class TestApprovedCreatePersists:
    async def test_tracker_create_calls_service_without_field_guard(self, monkeypatch):
        """The reported bug: approved create-application must hit the service."""
        rec = _Recorder(result={"id": "app_new"})
        set_art = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "create_application", rec)
        monkeypatch.setattr(
            "src.services.hitl_service.HITLRepository.set_artifact_id", set_art
        )

        await HITLService._apply_change(
            "user_1", _rec("tracker", "create", university="MIT", program="EECS PhD"), None
        )

        assert rec.calls == [(("user_1", {"university": "MIT", "program": "EECS PhD"}), {})]

    async def test_already_persisted_is_not_duplicated(self, monkeypatch):
        rec = _Recorder(result={"id": "x"})
        monkeypatch.setattr(tracker_mod.TrackerService, "create_application", rec)
        record = _rec("tracker", "create", university="MIT", program="X")
        record["artifact_id"] = "app_existing"

        await HITLService._apply_change("user_1", record, None)

        assert rec.calls == []  # dedup guard


class TestApprovedDeletePersists:
    async def test_tracker_delete(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "delete_application", rec)
        await HITLService._apply_change("user_1", _rec("tracker", "delete", ref_id="app_42"), None)
        assert rec.calls == [(("user_1", "app_42"), {})]

    async def test_draft_delete(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(drafts_mod.DraftsService, "delete_draft", rec)
        await HITLService._apply_change("user_1", _rec("draft", "delete", ref_id="d_7"), None)
        assert rec.calls == [(("user_1", "d_7"), {})]

    async def test_bulk_delete_via_ref_ids(self, monkeypatch):
        """The 20:13 transcript shape: ref_ids array, empty fields — both must delete."""
        rec = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "delete_application", rec)
        record = {
            "id": "hitl_1",
            "payload": {
                "entity": "tracker",
                "action": "delete",
                "ref_ids": ["app_a", "app_b"],
                "fields": {},
            },
        }
        await HITLService._apply_change("user_1", record, None)
        assert rec.calls == [(("user_1", "app_a"), {}), (("user_1", "app_b"), {})]


class TestApprovedUpdatePersists:
    async def test_tracker_update_passes_fields(self, monkeypatch):
        rec = _Recorder(result={})
        monkeypatch.setattr(tracker_mod.TrackerService, "update_application", rec)
        await HITLService._apply_change(
            "user_1", _rec("tracker", "update", ref_id="app_1", status="submitted"), None
        )
        assert rec.calls == [(("user_1", "app_1", {"status": "submitted"}), {})]

    async def test_human_edits_override_payload(self, monkeypatch):
        rec = _Recorder(result={})
        monkeypatch.setattr(tracker_mod.TrackerService, "update_application", rec)
        await HITLService._apply_change(
            "user_1",
            _rec("tracker", "update", ref_id="app_1", status="submitted"),
            {"fields": {"status": "accepted"}},
        )
        assert rec.calls[0][0] == ("user_1", "app_1", {"status": "accepted"})

    async def test_shortlist_outreach_status_uses_dedicated_method(self, monkeypatch):
        upd = _Recorder(result={})
        status = _Recorder()
        monkeypatch.setattr(shortlist_mod.ShortlistService, "update_faculty", upd)
        monkeypatch.setattr(shortlist_mod.ShortlistService, "update_outreach_status", status)
        await HITLService._apply_change(
            "user_1", _rec("shortlist", "update", ref_id="f_1", outreach_status="email_sent"), None
        )
        assert status.calls == [(("user_1", "f_1", "email_sent"), {})]
        assert upd.calls == []

    async def test_profile_update_is_user_keyed(self, monkeypatch):
        rec = _Recorder(result={})
        monkeypatch.setattr(users_mod.UserService, "update_profile", rec)
        await HITLService._apply_change(
            "user_1", _rec("profile", "update", degree="PhD"), None
        )
        assert rec.calls == [(("user_1", {"degree": "PhD"}), {})]


class TestRecommender:
    async def test_recommender_add_uses_application_id_as_ref(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "add_recommender", rec)
        await HITLService._apply_change(
            "user_1", _rec("recommender", "create", ref_id="app_1", name="Dr. Ng", status="not_asked"), None
        )
        assert rec.calls == [(("user_1", "app_1", {"name": "Dr. Ng", "status": "not_asked"}), {})]

    async def test_recommender_status_update(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "update_recommender_status", rec)
        await HITLService._apply_change(
            "user_1", _rec("recommender", "update", ref_id="app_1", name="Dr. Ng", status="received"), None
        )
        assert rec.calls == [(("user_1", "app_1", "Dr. Ng", "received"), {})]


class TestDuplicateGateSuppression:
    """Backstop: the agent re-opening an already-resolved gate must not show a
    second approval card."""

    async def test_identical_resolved_gate_is_duplicate(self, monkeypatch):
        from src.api import chat as chat_mod

        payload = {"entity": "shortlist", "action": "delete", "ref_id": "f_1",
                   "fields": {"name": "Prof. Andrew Ng"}}
        prior = _Recorder(result=[{"status": "approved", "payload": dict(payload)}])
        monkeypatch.setattr(chat_mod.HITLService, "list_hitl", prior)

        assert await chat_mod._is_duplicate_of_resolved("u", "s", payload) is True

    async def test_pending_gate_is_not_a_duplicate(self, monkeypatch):
        from src.api import chat as chat_mod

        payload = {"entity": "shortlist", "action": "delete", "ref_id": "f_1"}
        prior = _Recorder(result=[{"status": "pending", "payload": dict(payload)}])
        monkeypatch.setattr(chat_mod.HITLService, "list_hitl", prior)

        assert await chat_mod._is_duplicate_of_resolved("u", "s", payload) is False

    async def test_different_target_is_not_a_duplicate(self, monkeypatch):
        from src.api import chat as chat_mod

        prior = _Recorder(result=[{"status": "approved",
                                   "payload": {"entity": "shortlist", "action": "delete", "ref_id": "OTHER"}}])
        monkeypatch.setattr(chat_mod.HITLService, "list_hitl", prior)

        payload = {"entity": "shortlist", "action": "delete", "ref_id": "f_1"}
        assert await chat_mod._is_duplicate_of_resolved("u", "s", payload) is False

    def test_signature_none_when_entity_missing(self):
        from src.api import chat as chat_mod

        assert chat_mod._payload_signature({"action": "delete"}) is None

    def test_delete_signature_ignores_ref_id_vs_ref_ids_and_fields(self):
        """The real-world duplicate: gate 1 uses ref_id + fields, gate 2 uses
        ref_ids + empty fields. Same target → same signature."""
        from src.api import chat as chat_mod

        g1 = {"entity": "tracker", "action": "delete", "ref_id": "app_1",
              "fields": {"university": "Waterloo", "program": "MMath"}}
        g2 = {"entity": "tracker", "action": "delete", "ref_ids": ["app_1"], "fields": {}}
        assert chat_mod._payload_signature(g1) == chat_mod._payload_signature(g2)

    def test_create_signature_uses_fields(self):
        from src.api import chat as chat_mod

        a = {"entity": "tracker", "action": "create", "fields": {"university": "MIT"}}
        b = {"entity": "tracker", "action": "create", "fields": {"university": "Stanford"}}
        assert chat_mod._payload_signature(a) != chat_mod._payload_signature(b)


class TestApplyBeforeResolve:
    """resolve_hitl must apply the change BEFORE marking resolved, and must NOT
    mark resolved (no false 'Saved') if the apply fails."""

    async def test_apply_failure_leaves_gate_unresolved_and_raises(self, monkeypatch):
        from src.services.hitl_service import HITLService as Svc

        record = {"id": "h1", "status": "pending",
                  "payload": {"entity": "tracker", "action": "delete", "ref_id": "app_1"}}
        get = _Recorder(result=record)
        marked = _Recorder(result=(record, True))
        monkeypatch.setattr("src.services.hitl_service.HITLRepository.get_hitl", get)
        monkeypatch.setattr("src.services.hitl_service.HITLRepository.resolve_hitl", marked)

        async def _boom(*a, **k):
            raise RuntimeError("service down")

        monkeypatch.setattr(tracker_mod.TrackerService, "delete_application", _boom)

        with pytest.raises(RuntimeError):
            await Svc.resolve_hitl("u", "h1", "approved", None)
        assert marked.calls == []  # never marked resolved

    async def test_already_resolved_is_idempotent_no_reapply(self, monkeypatch):
        from src.services.hitl_service import HITLService as Svc

        record = {"id": "h1", "status": "approved",
                  "payload": {"entity": "tracker", "action": "delete", "ref_id": "app_1"}}
        monkeypatch.setattr(
            "src.services.hitl_service.HITLRepository.get_hitl", _Recorder(result=record)
        )
        delete = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "delete_application", delete)

        rec, newly = await Svc.resolve_hitl("u", "h1", "approved", None)
        assert newly is False
        assert delete.calls == []  # not re-applied


class TestGuards:
    async def test_missing_ref_id_skips_delete(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(tracker_mod.TrackerService, "delete_application", rec)
        await HITLService._apply_change("user_1", _rec("tracker", "delete"), None)
        assert rec.calls == []  # never deletes a null id


class TestAutoApproveAlwaysGatesDeletes:
    """Issue B: auto_approve must NOT bypass irreversible deletes."""

    def _ctx(self, auto_approve: bool):
        return SimpleNamespace(state={"auto_approve": auto_approve})

    def _settings_with(self, *tools):
        return SimpleNamespace(SENSITIVE_TOOLS=list(tools))

    def test_delete_is_blocked_even_under_auto_approve(self, monkeypatch):
        monkeypatch.setattr(cb, "get_settings", lambda: self._settings_with("delete_application"))
        result = cb.enforce_hitl_policy_callback(
            SimpleNamespace(name="delete_application"), {}, self._ctx(auto_approve=True)
        )
        assert result is not None and result["error_code"] == "APPROVAL_REQUIRED"

    def test_non_destructive_write_passes_under_auto_approve(self, monkeypatch):
        monkeypatch.setattr(cb, "get_settings", lambda: self._settings_with("create_application"))
        result = cb.enforce_hitl_policy_callback(
            SimpleNamespace(name="create_application"), {}, self._ctx(auto_approve=True)
        )
        assert result is None  # allowed through

    def test_sensitive_write_blocked_without_auto_approve(self, monkeypatch):
        monkeypatch.setattr(cb, "get_settings", lambda: self._settings_with("create_application"))
        result = cb.enforce_hitl_policy_callback(
            SimpleNamespace(name="create_application"), {}, self._ctx(auto_approve=False)
        )
        assert result is not None and result["error_code"] == "APPROVAL_REQUIRED"

    def test_non_sensitive_tool_always_passes(self, monkeypatch):
        monkeypatch.setattr(cb, "get_settings", lambda: self._settings_with("create_application"))
        result = cb.enforce_hitl_policy_callback(
            SimpleNamespace(name="list_applications"), {}, self._ctx(auto_approve=False)
        )
        assert result is None

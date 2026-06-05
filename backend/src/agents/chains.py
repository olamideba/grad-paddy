from google.adk.agents import SequentialAgent

from src.agents.subagents import (
    build_account_agent,
    build_application_agent,
    build_governance_agent,
    build_operations_agent,
    build_planner_agent,
    build_researcher_agent,
)


def build_application_intake_chain() -> SequentialAgent:
    """A reusable prompt chain for multi-step app intake tasks."""
    return SequentialAgent(
        name="application_intake_chain",
        sub_agents=[
            build_planner_agent(),
            build_researcher_agent(),
            build_application_agent(),
        ],
    )


def build_account_workflow_chain() -> SequentialAgent:
    """A reusable prompt chain for account and session setup tasks."""
    return SequentialAgent(
        name="account_workflow_chain",
        sub_agents=[
            build_planner_agent(),
            build_account_agent(),
        ],
    )


def build_governance_chain() -> SequentialAgent:
    """A reusable prompt chain for approval-gated flows."""
    return SequentialAgent(
        name="governance_chain",
        sub_agents=[
            build_planner_agent(),
            build_governance_agent(),
        ],
    )


def build_full_workflow_chain() -> SequentialAgent:
    """A reusable chain that walks a task from planning to execution."""
    return SequentialAgent(
        name="full_workflow_chain",
        sub_agents=[
            build_planner_agent(),
            build_researcher_agent(),
            build_operations_agent(),
        ],
    )


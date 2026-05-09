from app.models.schemas import SimulationPortfolio
from app.agents import compliance_guard_agent


def run(portfolio: SimulationPortfolio) -> SimulationPortfolio:
    """Final pass: ensure compliance and return simulation-ready portfolio."""
    portfolio = compliance_guard_agent.run(portfolio)
    return portfolio

from app.services.compliance_service import check_compliance, process_output
from app.models.schemas import SimulationPortfolio, Scenario


def _sanitize_scenario(scenario: Scenario) -> Scenario:
    scenario.explanation = process_output(scenario.explanation)
    scenario.expected_behavior = process_output(scenario.expected_behavior)
    scenario.warnings = [process_output(w) for w in scenario.warnings]
    return scenario


def run(portfolio: SimulationPortfolio) -> SimulationPortfolio:
    portfolio.protective_portfolio = _sanitize_scenario(portfolio.protective_portfolio)
    portfolio.balanced_portfolio = _sanitize_scenario(portfolio.balanced_portfolio)
    portfolio.aggressive_portfolio = _sanitize_scenario(portfolio.aggressive_portfolio)
    return portfolio


def check_text(text: str) -> tuple[bool, list[str]]:
    return check_compliance(text)

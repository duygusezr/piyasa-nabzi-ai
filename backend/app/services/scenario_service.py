from app.models.schemas import Scenario, ScenarioAllocation, SimulationPortfolio


DISCLAIMER = "Bu içerik yatırım tavsiyesi değildir. Gerçek para ile işlem yapılmaz. Simülasyon amaçlıdır."


def _build_protective(capital: float, assets: list[str]) -> Scenario:
    allocation = [
        ScenarioAllocation(asset="Altın", percentage=50.0,
                           rationale="Güvenli liman varlığı olarak volatiliteyi azaltır"),
        ScenarioAllocation(asset="Nakit / TL Mevduat", percentage=25.0,
                           rationale="Likidite ve istikrar sağlar"),
        ScenarioAllocation(asset="BIST Savunma / Kamu", percentage=15.0,
                           rationale="Düşük volatiliteli hisse sınıfı"),
        ScenarioAllocation(asset="Bitcoin", percentage=10.0,
                           rationale="Küçük kripto maruziyeti, volatilite sınırlı"),
    ]
    return Scenario(
        name="Koruyucu Senaryo",
        allocation=allocation,
        risk_score=2.5,
        opportunity_score=3.5,
        volatility_score=2.0,
        expected_behavior="Sermaye koruması önceliklidir. Düşük getiri beklentisi, yüksek istikrar.",
        explanation="Bu senaryo risk toleransı düşük yatırımcılar için tasarlanmış simülasyondur. "
                    "Altın ağırlıklı portföy makroekonomik belirsizliklere karşı tampon sağlayabilir.",
        warnings=[
            "Altın fiyatları döviz kuruna bağlıdır",
            "Mevduat faizi enflasyonun altında kalabilir",
            "Bu dağılım gerçek bir yatırım önerisi değildir",
        ],
        disclaimer=DISCLAIMER,
    )


def _build_balanced(capital: float, assets: list[str]) -> Scenario:
    allocation = [
        ScenarioAllocation(asset="Altın", percentage=35.0,
                           rationale="Makro hedge olarak kullanılır"),
        ScenarioAllocation(asset="BIST Çeşitlendirilmiş", percentage=30.0,
                           rationale="Yerel piyasa büyümesine katılım"),
        ScenarioAllocation(asset="Bitcoin", percentage=20.0,
                           rationale="Yüksek volatilite / yüksek potansiyel"),
        ScenarioAllocation(asset="Nakit", percentage=15.0,
                           rationale="Fırsat bekleyen likidite"),
    ]
    return Scenario(
        name="Dengeli Senaryo",
        allocation=allocation,
        risk_score=5.0,
        opportunity_score=6.0,
        volatility_score=5.5,
        expected_behavior="Risk ve getiri arasında denge aranır. Orta vadeli senaryo.",
        explanation="Bu senaryo çeşitlendirilmiş bir simülasyon portföyüdür. "
                    "Hem kripto hem de geleneksel varlıklara orta düzeyde maruziyeti kapsar.",
        warnings=[
            "Kripto piyasası yüksek volatilite taşır",
            "BIST hisseleri şirket ve sektör riskine tabidir",
            "Piyasa koşulları hızla değişebilir",
        ],
        disclaimer=DISCLAIMER,
    )


def _build_aggressive(capital: float, assets: list[str]) -> Scenario:
    allocation = [
        ScenarioAllocation(asset="Bitcoin / Kripto", percentage=50.0,
                           rationale="Yüksek risk / yüksek potansiyel varlık sınıfı"),
        ScenarioAllocation(asset="BIST Yüksek Momentum", percentage=30.0,
                           rationale="Momentum hisseleri kısa vadede büyük hareketler gösterebilir"),
        ScenarioAllocation(asset="Altın", percentage=10.0,
                           rationale="Minimum koruma hedge"),
        ScenarioAllocation(asset="Nakit", percentage=10.0,
                           rationale="Acil durum likidite"),
    ]
    return Scenario(
        name="Agresif Senaryo",
        allocation=allocation,
        risk_score=8.5,
        opportunity_score=8.0,
        volatility_score=9.0,
        expected_behavior="Yüksek risk toleransı gerektirir. Kayıp riski çok yüksektir.",
        explanation="Bu senaryo yüksek risk toleransına sahip, kısa vadeli hareket arayan simülasyondur. "
                    "Sermayenin tamamının kaybedilebileceği senaryolar dahil tüm riskler göz önünde bulundurulmalıdır.",
        warnings=[
            "Sermayenin büyük bölümü kısa sürede kaybedilebilir",
            "Kripto piyasası 7/24 işlem görür, ani hareketler olabilir",
            "Bu dağılım gerçek bir yatırım tavsiyesi değildir",
            "Yatırım kararlarınızda lisanslı bir mali müşavire danışın",
        ],
        disclaimer=DISCLAIMER,
    )


def build_simulation_portfolio(
    capital: float,
    currency: str,
    assets: list[str],
    gemini_scenarios: dict | None = None,
) -> SimulationPortfolio:
    """Build simulation portfolio. Uses Gemini output if available, else rule-based."""
    if gemini_scenarios:
        try:
            def _parse_scenario(data: dict, fallback_fn) -> Scenario:
                allocs = [
                    ScenarioAllocation(**a) for a in data.get("allocation", [])
                ]
                if not allocs:
                    return fallback_fn(capital, assets)
                return Scenario(
                    name=data.get("name", "Senaryo"),
                    allocation=allocs,
                    risk_score=float(data.get("risk_score", 5)),
                    opportunity_score=float(data.get("opportunity_score", 5)),
                    volatility_score=float(data.get("volatility_score", 5)),
                    expected_behavior=data.get("expected_behavior", ""),
                    explanation=data.get("explanation", ""),
                    warnings=data.get("warnings", []),
                    disclaimer=DISCLAIMER,
                )

            return SimulationPortfolio(
                initial_capital=capital,
                currency=currency,
                protective_portfolio=_parse_scenario(
                    gemini_scenarios.get("protective", {}),
                    _build_protective,
                ),
                balanced_portfolio=_parse_scenario(
                    gemini_scenarios.get("balanced", {}),
                    _build_balanced,
                ),
                aggressive_portfolio=_parse_scenario(
                    gemini_scenarios.get("aggressive", {}),
                    _build_aggressive,
                ),
                simulation_disclaimer=DISCLAIMER,
            )
        except Exception:
            pass

    return SimulationPortfolio(
        initial_capital=capital,
        currency=currency,
        protective_portfolio=_build_protective(capital, assets),
        balanced_portfolio=_build_balanced(capital, assets),
        aggressive_portfolio=_build_aggressive(capital, assets),
        simulation_disclaimer=DISCLAIMER,
    )

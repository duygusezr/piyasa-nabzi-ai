from app.models.schemas import MarketData
from app.services.market_data_service import get_market_data


async def run() -> MarketData:
    return await get_market_data()

import logging

from app.tools.weather import weather_lookup
from app.schemas.weather import WeatherRequest, WeatherIntelligence

logger = logging.getLogger("app.agents.weather")

def analyze_weather(payload: WeatherRequest) -> WeatherIntelligence:
    """
    Fetch a real forecast and calculate a suitability score.
    """
    location = payload.location
    days = payload.days or 7

    forecast_data = weather_lookup(location=location, days=days)
    forecast = forecast_data.get("forecast", [])

    if not forecast:
        return WeatherIntelligence(
            temperature="N/A",
            rain_probability="N/A",
            suitability_score=50,
            warnings=["No forecast details available."]
        )

    # Calculate metrics
    total_temp = 0
    max_rain = 0
    warnings = []

    for day in forecast:
        temp = day.get("temp_c") or 20
        rain_str = day.get("rain_probability", "0%")
        rain_val = int(rain_str.replace("%", ""))

        total_temp += temp
        if rain_val > max_rain:
            max_rain = rain_val

    avg_temp = total_temp / len(forecast)

    # 1. Compute suitability score (starting at 100)
    score = 100

    # Deduct for rain
    score -= (max_rain * 0.4)

    # Deduct for temperature extremes
    temp_penalty = 0
    if avg_temp > 32:
        temp_penalty = (avg_temp - 32) * 2
    elif avg_temp < 15:
        temp_penalty = (15 - avg_temp) * 2
    score -= temp_penalty

    # Deduct for specific warnings
    if max_rain > 70:
        warnings.append("Heavy rain/storms forecast. Outdoor travel not recommended.")
        score -= 20
    elif max_rain > 40:
        warnings.append("Moderate rain expected. Carry umbrellas/raincoats.")

    if avg_temp > 38:
        warnings.append("Extreme heat warning. Stay hydrated.")
        score -= 15
    elif avg_temp < 5:
        warnings.append("Extreme cold warning. Wear heavy winter layers.")
        score -= 15

    final_score = min(max(int(score), 0), 100)

    # Format returns
    return WeatherIntelligence(
        temperature=f"{int(avg_temp)}C",
        rain_probability=f"{max_rain}%",
        suitability_score=final_score,
        warnings=warnings
    )

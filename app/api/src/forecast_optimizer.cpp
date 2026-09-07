#include "deliveryoptimizer/api/forecast_optimizer.hpp"

#include "deliveryoptimizer/adapters/json_utils.hpp"
#include "deliveryoptimizer/api/optimize_request.hpp"

#include <algorithm>
#include <atomic>
#include <charconv>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <drogon/drogon.h>
#include <future>
#include <iomanip>
#include <iterator>
#include <limits>
#include <memory>
#include <numeric>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace {

constexpr std::string_view kWeatherEnabledEnv = "DELIVERYOPTIMIZER_WEATHER_FORECAST_ENABLED";
constexpr std::string_view kWeatherDelayPerStopEnv =
    "DELIVERYOPTIMIZER_WEATHER_DELAY_SECONDS_PER_STOP";
constexpr std::string_view kWeatherThresholdSecondsEnv =
    "DELIVERYOPTIMIZER_WEATHER_REOPTIMIZE_THRESHOLD_SECONDS";
constexpr std::string_view kWeatherThresholdPercentEnv =
    "DELIVERYOPTIMIZER_WEATHER_REOPTIMIZE_THRESHOLD_PERCENT";
constexpr std::string_view kOpenWeatherApiKeyEnv = "OPENWEATHER_API_KEY";
constexpr std::string_view kOpenWeatherBaseUrlEnv = "OPENWEATHER_BASE_URL";
constexpr std::string_view kDefaultOpenWeatherBaseUrl = "https://api.openweathermap.org";
constexpr std::string_view kTrafficEnabledEnv = "DELIVERYOPTIMIZER_TRAFFIC_FORECAST_ENABLED";
constexpr std::string_view kTrafficThresholdSecondsEnv =
    "DELIVERYOPTIMIZER_TRAFFIC_REOPTIMIZE_THRESHOLD_SECONDS";
constexpr std::string_view kTrafficThresholdPercentEnv =
    "DELIVERYOPTIMIZER_TRAFFIC_REOPTIMIZE_THRESHOLD_PERCENT";
constexpr std::string_view kGoogleMapsApiKeyEnv = "GOOGLE_MAPS_API_KEY";
constexpr std::string_view kGoogleMapsBaseUrlEnv = "GOOGLE_MAPS_BASE_URL";
constexpr std::string_view kDefaultGoogleMapsBaseUrl = "https://maps.googleapis.com";
constexpr int kOpenWeatherTimeoutSeconds = 4;
constexpr int kGoogleMapsTimeoutSeconds = 4;
constexpr std::size_t kMaxConcurrentTrafficRequests = 4U;
constexpr int kDefaultWeatherThresholdSeconds = 300;
constexpr double kDefaultWeatherThresholdPercent = 5.0;
constexpr int kDefaultTrafficThresholdSeconds = 300;
constexpr double kDefaultTrafficThresholdPercent = 5.0;

[[nodiscard]] bool IsEnabledFlag(const char* raw_value) {
  if (raw_value == nullptr || *raw_value == '\0') {
    return false;
  }

  const std::string_view value{raw_value};
  return value == "1" || value == "true" || value == "TRUE" || value == "yes" || value == "YES";
}

[[nodiscard]] std::optional<int> ParseNonNegativeInt(const char* raw_value) {
  if (raw_value == nullptr || *raw_value == '\0') {
    return std::nullopt;
  }

  const std::string_view text{raw_value};
  int parsed_value = 0;
  const auto [end_ptr, error] =
      std::from_chars(text.data(), text.data() + text.size(), parsed_value);
  if (error != std::errc{} || end_ptr != text.data() + text.size() || parsed_value < 0) {
    return std::nullopt;
  }

  return parsed_value;
}

[[nodiscard]] std::optional<double> ParseNonNegativeDouble(const char* raw_value) {
  if (raw_value == nullptr || *raw_value == '\0') {
    return std::nullopt;
  }

  char* end_ptr = nullptr;
  const double parsed_value = std::strtod(raw_value, &end_ptr);
  if (end_ptr == raw_value || *end_ptr != '\0' || parsed_value < 0.0) {
    return std::nullopt;
  }

  return parsed_value;
}

[[nodiscard]] std::string ResolveStringEnvOrDefault(const char* key,
                                                    const std::string_view fallback) {
  const char* raw_value = std::getenv(key);
  if (raw_value == nullptr || *raw_value == '\0') {
    return std::string{fallback};
  }

  return std::string{raw_value};
}

[[nodiscard]] int ClampToInt(const long long value) {
  if (value > static_cast<long long>(std::numeric_limits<int>::max())) {
    return std::numeric_limits<int>::max();
  }

  return static_cast<int>(value);
}

[[nodiscard]] std::string FormatCoordinate(const double value) {
  std::ostringstream stream;
  stream << std::fixed << std::setprecision(6) << value;
  return stream.str();
}

[[nodiscard]] std::string BuildOpenWeatherPath(const deliveryoptimizer::api::Coordinate& coordinate,
                                               const std::string& api_key) {
  return "/data/3.0/onecall?lat=" + FormatCoordinate(coordinate.lat) +
         "&lon=" + FormatCoordinate(coordinate.lon) +
         "&exclude=current,minutely,daily,alerts&units=metric&appid=" + api_key;
}

[[nodiscard]] int DelayFromHourlyForecast(const Json::Value& hour) {
  int delay_seconds = 0;
  const double wind_speed = hour["wind_speed"].isNumeric() ? hour["wind_speed"].asDouble() : 0.0;
  const int visibility = hour["visibility"].isInt() ? hour["visibility"].asInt() : 10000;
  bool has_thunder = false;
  const Json::Value& weather = hour["weather"];
  if (weather.isArray()) {
    for (const Json::Value& condition : weather) {
      const int condition_id = condition["id"].isInt() ? condition["id"].asInt() : 0;
      if (condition_id >= 200 && condition_id < 300) {
        has_thunder = true;
      }
    }
  }

  if (wind_speed >= 10.0) {
    delay_seconds += 60;
  }
  if (visibility < 5000) {
    delay_seconds += 60;
  }
  if (has_thunder) {
    delay_seconds += 240;
  } else if (hour["rain"].isObject()) {
    delay_seconds += 90;
  }
  if (hour["snow"].isObject()) {
    delay_seconds += 180;
  }

  return delay_seconds;
}

[[nodiscard]] bool IsRouteHour(const Json::Value& hour,
                               const std::chrono::sys_seconds route_start_time,
                               const std::optional<int> route_duration_seconds) {
  if (!hour["dt"].isInt64() && !hour["dt"].isUInt64()) {
    return false;
  }

  const auto forecast_time =
      std::chrono::sys_seconds{std::chrono::seconds{hour["dt"].asLargestInt()}};
  const int window_seconds = std::max(route_duration_seconds.value_or(6 * 60 * 60), 60 * 60);
  return forecast_time >= route_start_time &&
         forecast_time < route_start_time + std::chrono::seconds{window_seconds};
}

void SetRouteTimes(const std::optional<std::chrono::sys_seconds> planned_start_time,
                   deliveryoptimizer::api::WeatherImpactEstimate& impact) {
  impact.planned_start_time = planned_start_time;
  if (!impact.planned_start_time.has_value()) {
    impact.estimated_finish_time = std::nullopt;
    return;
  }

  impact.estimated_finish_time =
      *impact.planned_start_time + std::chrono::seconds{impact.weather_adjusted_duration_seconds};
}

[[nodiscard]] std::chrono::sys_seconds
ReadLegDeparture(const Json::Value& step,
                 const std::optional<std::chrono::sys_seconds> route_start_time) {
  constexpr std::chrono::seconds kMaxRelativeArrivalOffset = std::chrono::days{7};
  const auto now =
      std::chrono::time_point_cast<std::chrono::seconds>(std::chrono::system_clock::now());
  const int arrival = step["arrival"].isInt() ? step["arrival"].asInt() : 0;
  const int service = step["service"].isInt() ? step["service"].asInt() : 0;
  const std::chrono::seconds offset{std::max(arrival + service, 0)};
  if (route_start_time.has_value()) {
    const std::chrono::seconds route_start_seconds =
        std::chrono::duration_cast<std::chrono::seconds>(route_start_time->time_since_epoch());
    // Large arrivals are Unix timestamps; smaller arrivals are route offsets.
    if (offset >= route_start_seconds - std::chrono::hours{24}) {
      return std::max(std::chrono::sys_seconds{offset}, now);
    }

    return std::max(*route_start_time + std::min(offset, kMaxRelativeArrivalOffset), now);
  }

  // Without a route start, a Unix timestamp in arrival would otherwise be
  // interpreted as a multi-decade relative offset. Ignore implausible offsets.
  return now + (offset <= kMaxRelativeArrivalOffset ? offset : std::chrono::seconds{0});
}

[[nodiscard]] std::vector<int> BuildEvenTrafficDelays(const std::size_t job_count,
                                                      const int total_delay_seconds) {
  std::vector<int> delays(job_count, 0);
  if (job_count == 0U || total_delay_seconds <= 0) {
    return delays;
  }

  const int delay_per_stop = static_cast<int>(
      std::ceil(static_cast<double>(total_delay_seconds) / static_cast<double>(job_count)));
  std::fill(delays.begin(), delays.end(), delay_per_stop);
  return delays;
}

[[nodiscard]] std::vector<std::uint64_t> ReadPayloadJobIds(const Json::Value& payload) {
  std::vector<std::uint64_t> job_ids;
  const Json::Value& jobs = payload["jobs"];
  if (!jobs.isArray()) {
    return job_ids;
  }

  job_ids.reserve(jobs.size());
  for (const Json::Value& job : jobs) {
    job_ids.push_back(job["id"].isUInt64() ? job["id"].asUInt64() : 0U);
  }

  return job_ids;
}

[[nodiscard]] std::vector<int> ReadJobTravelSeconds(const Json::Value& vroom_output,
                                                    const std::vector<std::uint64_t>& job_ids) {
  const std::size_t job_count = job_ids.size();
  std::vector<int> travel_seconds(job_count, 0);
  const Json::Value& routes = vroom_output["routes"];
  if (!routes.isArray()) {
    return travel_seconds;
  }

  for (const Json::Value& route : routes) {
    const Json::Value& steps = route["steps"];
    if (!steps.isArray() || steps.size() < 2U) {
      continue;
    }

    for (Json::ArrayIndex index = 1U; index < steps.size(); ++index) {
      const Json::Value& from = steps[index - 1U];
      const Json::Value& to = steps[index];
      if (to["type"].isString() && to["type"].asString() != "job") {
        continue;
      }
      if (!to["id"].isUInt64()) {
        continue;
      }

      const std::uint64_t raw_job_id = to["id"].asUInt64();
      if (raw_job_id == 0U) {
        continue;
      }

      const auto job_id = std::find(job_ids.begin(), job_ids.end(), raw_job_id);
      if (job_id == job_ids.end()) {
        continue;
      }

      const int from_arrival = from["arrival"].isInt() ? from["arrival"].asInt() : 0;
      const int from_service = from["service"].isInt() ? from["service"].asInt() : 0;
      const int to_arrival = to["arrival"].isInt() ? to["arrival"].asInt() : from_arrival;
      const int leg_seconds = std::max(to_arrival - from_arrival - from_service, 0);
      const std::size_t job_index =
          static_cast<std::size_t>(std::distance(job_ids.begin(), job_id));
      travel_seconds[job_index] += leg_seconds;
    }
  }

  return travel_seconds;
}

[[nodiscard]] std::vector<int> BuildWeightedTrafficDelays(const Json::Value& vroom_output,
                                                          const std::vector<std::uint64_t>& job_ids,
                                                          const int total_delay_seconds) {
  const std::size_t job_count = job_ids.size();
  if (job_count == 0U || total_delay_seconds <= 0) {
    return std::vector<int>(job_count, 0);
  }

  const std::vector<int> travel_seconds = ReadJobTravelSeconds(vroom_output, job_ids);
  const int total_travel_seconds = std::accumulate(travel_seconds.begin(), travel_seconds.end(), 0);
  if (total_travel_seconds <= 0) {
    return BuildEvenTrafficDelays(job_count, total_delay_seconds);
  }

  std::vector<int> delays(job_count, 0);
  int assigned_delay = 0;
  std::vector<std::pair<double, std::size_t>> remainders;
  remainders.reserve(job_count);
  for (std::size_t index = 0U; index < job_count; ++index) {
    const double raw_delay = static_cast<double>(total_delay_seconds) *
                             static_cast<double>(travel_seconds[index]) /
                             static_cast<double>(total_travel_seconds);
    delays[index] = static_cast<int>(std::floor(raw_delay));
    assigned_delay += delays[index];
    remainders.emplace_back(raw_delay - static_cast<double>(delays[index]), index);
  }

  std::sort(remainders.begin(), remainders.end(),
            [](const auto& left, const auto& right) { return left.first > right.first; });
  int remaining_delay = total_delay_seconds - assigned_delay;
  for (const auto& remainder : remainders) {
    if (remaining_delay <= 0) {
      break;
    }
    const std::size_t index = remainder.second;
    ++delays[index];
    --remaining_delay;
  }

  return delays;
}

template <typename Result, typename ParseResponse>
[[nodiscard]] Result FetchJsonWithTimeout(const std::string& base_url, const std::string& path,
                                          const int timeout_seconds, Result fallback,
                                          ParseResponse parse_response) {
  auto client = drogon::HttpClient::newHttpClient(base_url);
  auto request = drogon::HttpRequest::newHttpRequest();
  request->setMethod(drogon::Get);
  request->setPath(path);

  auto promise = std::make_shared<std::promise<Result>>();
  auto future = promise->get_future();
  client->sendRequest(
      request,
      [promise, fallback, parse_response = std::move(parse_response)](
          const drogon::ReqResult result, const drogon::HttpResponsePtr& response) mutable {
        if (result != drogon::ReqResult::Ok || response == nullptr ||
            response->getStatusCode() != drogon::k200OK) {
          promise->set_value(fallback);
          return;
        }

        const auto body = response->getJsonObject();
        promise->set_value(body == nullptr ? fallback : parse_response(*body));
      },
      timeout_seconds);

  if (future.wait_for(std::chrono::seconds{timeout_seconds + 1}) != std::future_status::ready) {
    return fallback;
  }

  return future.get();
}

} // namespace

namespace deliveryoptimizer::api {

WeatherForecastOptions ResolveWeatherForecastOptionsFromEnv() {
  return WeatherForecastOptions{
      .enabled = IsEnabledFlag(std::getenv(kWeatherEnabledEnv.data())),
      .weather_delay_seconds_per_stop =
          ParseNonNegativeInt(std::getenv(kWeatherDelayPerStopEnv.data())).value_or(0),
      .reoptimize_threshold_seconds =
          ParseNonNegativeInt(std::getenv(kWeatherThresholdSecondsEnv.data()))
              .value_or(kDefaultWeatherThresholdSeconds),
      .reoptimize_threshold_percent =
          ParseNonNegativeDouble(std::getenv(kWeatherThresholdPercentEnv.data()))
              .value_or(kDefaultWeatherThresholdPercent),
      .openweather_api_key = ResolveStringEnvOrDefault(kOpenWeatherApiKeyEnv.data(), ""),
      .openweather_base_url =
          ResolveStringEnvOrDefault(kOpenWeatherBaseUrlEnv.data(), kDefaultOpenWeatherBaseUrl),
  };
}

TrafficForecastOptions ResolveTrafficForecastOptionsFromEnv() {
  return TrafficForecastOptions{
      .enabled = IsEnabledFlag(std::getenv(kTrafficEnabledEnv.data())),
      .reoptimize_threshold_seconds =
          ParseNonNegativeInt(std::getenv(kTrafficThresholdSecondsEnv.data()))
              .value_or(kDefaultTrafficThresholdSeconds),
      .reoptimize_threshold_percent =
          ParseNonNegativeDouble(std::getenv(kTrafficThresholdPercentEnv.data()))
              .value_or(kDefaultTrafficThresholdPercent),
      .google_maps_api_key = ResolveStringEnvOrDefault(kGoogleMapsApiKeyEnv.data(), ""),
      .google_maps_base_url =
          ResolveStringEnvOrDefault(kGoogleMapsBaseUrlEnv.data(), kDefaultGoogleMapsBaseUrl),
  };
}

bool IsOpenWeatherConfigured(const WeatherForecastOptions& options) {
  return options.enabled && !options.openweather_api_key.empty();
}

int EstimateServiceSeconds(const OptimizeRequestInput& input) {
  std::int64_t total = 0;
  for (const auto& job : input.jobs) {
    total += job.service;
    if (total >= std::numeric_limits<int>::max()) {
      return std::numeric_limits<int>::max();
    }
  }

  return static_cast<int>(total);
}

bool IsGoogleMapsConfigured(const TrafficForecastOptions& options) {
  return options.enabled && !options.google_maps_api_key.empty();
}

OpenWeatherDelayEstimate
FetchOpenWeatherDelayEstimate(const WeatherForecastOptions& options, const Coordinate& coordinate,
                              const std::optional<std::chrono::sys_seconds> route_start_time,
                              const std::optional<int> route_duration_seconds) {
  if (!IsOpenWeatherConfigured(options)) {
    return OpenWeatherDelayEstimate{
        .available = false,
        .delay_seconds_per_stop = 0,
        .source = "",
    };
  }

  const OpenWeatherDelayEstimate unavailable{
      .available = false,
      .delay_seconds_per_stop = 0,
      .source = "",
  };
  return FetchJsonWithTimeout(
      options.openweather_base_url, BuildOpenWeatherPath(coordinate, options.openweather_api_key),
      kOpenWeatherTimeoutSeconds, unavailable,
      [route_start_time, route_duration_seconds](const Json::Value& body) {
        return OpenWeatherDelayEstimate{
            .available = true,
            .delay_seconds_per_stop =
                ReadOpenWeatherDelay(body, route_start_time, route_duration_seconds),
            .source = "openweather",
        };
      });
}

int ReadOpenWeatherDelay(const Json::Value& body,
                         const std::optional<std::chrono::sys_seconds> route_start_time,
                         const std::optional<int> route_duration_seconds) {
  const Json::Value& hourly = body["hourly"];
  if (!hourly.isArray()) {
    return 0;
  }

  if (!route_start_time.has_value()) {
    int fallback_delay_seconds = 0;
    const Json::ArrayIndex hours_to_scan = std::min<Json::ArrayIndex>(hourly.size(), 6U);
    for (Json::ArrayIndex index = 0U; index < hours_to_scan; ++index) {
      fallback_delay_seconds =
          std::max(fallback_delay_seconds, DelayFromHourlyForecast(hourly[index]));
    }
    return fallback_delay_seconds;
  }

  int delay_seconds = 0;
  Json::ArrayIndex matched_hours = 0U;
  for (Json::ArrayIndex index = 0U; index < hourly.size(); ++index) {
    if (!IsRouteHour(hourly[index], *route_start_time, route_duration_seconds)) {
      continue;
    }
    delay_seconds = std::max(delay_seconds, DelayFromHourlyForecast(hourly[index]));
    ++matched_hours;
  }

  if (matched_hours > 0U) {
    return delay_seconds;
  }

  const Json::ArrayIndex hours_to_scan = std::min<Json::ArrayIndex>(hourly.size(), 6U);
  for (Json::ArrayIndex index = 0U; index < hours_to_scan; ++index) {
    delay_seconds = std::max(delay_seconds, DelayFromHourlyForecast(hourly[index]));
  }

  return delay_seconds;
}

std::string BuildTrafficPath(const Coordinate& origin, const Coordinate& destination,
                             const std::chrono::sys_seconds departure_time,
                             const std::string& api_key) {
  const std::string origin_text = FormatCoordinate(origin.lat) + "," + FormatCoordinate(origin.lon);
  const std::string destination_text =
      FormatCoordinate(destination.lat) + "," + FormatCoordinate(destination.lon);
  const auto departure_seconds =
      std::chrono::duration_cast<std::chrono::seconds>(departure_time.time_since_epoch()).count();

  return "/maps/api/distancematrix/json?origins=" + origin_text +
         "&destinations=" + destination_text +
         "&departure_time=" + std::to_string(departure_seconds) +
         "&traffic_model=best_guess&key=" + api_key;
}

std::optional<int> ReadTrafficDelay(const Json::Value& body) {
  const Json::Value& rows = body["rows"];
  if (!rows.isArray() || rows.empty()) {
    return std::nullopt;
  }

  const Json::Value& elements = rows[0]["elements"];
  if (!elements.isArray() || elements.empty()) {
    return std::nullopt;
  }

  const Json::Value& leg = elements[0];
  if (leg["status"].isString() && leg["status"].asString() != "OK") {
    return std::nullopt;
  }
  if (!leg["duration"]["value"].isInt() || !leg["duration_in_traffic"]["value"].isInt()) {
    return std::nullopt;
  }

  return std::max(leg["duration_in_traffic"]["value"].asInt() - leg["duration"]["value"].asInt(),
                  0);
}

TrafficDelayEstimate FetchTrafficDelay(const TrafficForecastOptions& options,
                                       const TrafficLeg& leg) {
  if (!IsGoogleMapsConfigured(options)) {
    return TrafficDelayEstimate{
        .available = false,
        .delay_seconds = 0,
        .source = "",
    };
  }

  const TrafficDelayEstimate unavailable{
      .available = false,
      .delay_seconds = 0,
      .source = "",
  };
  return FetchJsonWithTimeout(options.google_maps_base_url,
                              BuildTrafficPath(leg.origin, leg.destination, leg.departure_time,
                                               options.google_maps_api_key),
                              kGoogleMapsTimeoutSeconds, unavailable, [](const Json::Value& body) {
                                const std::optional<int> delay = ReadTrafficDelay(body);
                                return TrafficDelayEstimate{
                                    .available = delay.has_value(),
                                    .delay_seconds = delay.value_or(0),
                                    .source = delay.has_value() ? "google_maps" : "",
                                };
                              });
}

std::vector<TrafficLeg>
ReadTrafficLegs(const Json::Value& vroom_output,
                const std::optional<std::chrono::sys_seconds> route_start_time) {
  const Json::Value& routes = vroom_output["routes"];
  if (!routes.isArray()) {
    return {};
  }

  std::vector<TrafficLeg> legs;
  for (const Json::Value& route : routes) {
    const Json::Value& steps = route["steps"];
    if (!steps.isArray() || steps.size() < 2U) {
      continue;
    }

    for (Json::ArrayIndex index = 1U; index < steps.size(); ++index) {
      const Json::Value& from = steps[index - 1U];
      const Json::Value& to = steps[index];
      const Json::Value& from_location = from["location"];
      const Json::Value& to_location = to["location"];
      if (!from_location.isArray() || from_location.size() != 2U || !to_location.isArray() ||
          to_location.size() != 2U) {
        continue;
      }

      legs.push_back(TrafficLeg{
          .origin =
              Coordinate{.lon = from_location[0U].asDouble(), .lat = from_location[1U].asDouble()},
          .destination =
              Coordinate{.lon = to_location[0U].asDouble(), .lat = to_location[1U].asDouble()},
          .departure_time = ReadLegDeparture(from, route_start_time),
      });
    }
  }

  return legs;
}

TrafficDelayEstimate
ReadRouteTraffic(const TrafficForecastOptions& options, const Json::Value& vroom_output,
                 const std::optional<std::chrono::sys_seconds> route_start_time) {
  if (!IsGoogleMapsConfigured(options)) {
    return TrafficDelayEstimate{
        .available = false,
        .delay_seconds = 0,
        .source = "",
    };
  }

  const std::vector<TrafficLeg> legs = ReadTrafficLegs(vroom_output, route_start_time);
  std::vector<TrafficDelayEstimate> estimates(legs.size());
  std::atomic_size_t next_leg{0U};
  const std::size_t worker_count = std::min(kMaxConcurrentTrafficRequests, legs.size());

  std::vector<std::jthread> workers;
  workers.reserve(worker_count);
  for (std::size_t worker = 0U; worker < worker_count; ++worker) {
    workers.emplace_back([&options, &legs, &estimates, &next_leg] {
      while (true) {
        const std::size_t index = next_leg.fetch_add(1U);
        if (index >= legs.size()) {
          return;
        }
        estimates[index] = FetchTrafficDelay(options, legs[index]);
      }
    });
  }
  // Explicitly wait for every request worker; these workers do not support cancellation.
  for (std::jthread& worker : workers) {
    worker.join();
  }

  int delay_seconds = 0;
  bool saw_traffic = false;
  for (const TrafficDelayEstimate& estimate : estimates) {
    if (!estimate.available) {
      continue;
    }
    delay_seconds += estimate.delay_seconds;
    saw_traffic = true;
  }

  return TrafficDelayEstimate{
      .available = saw_traffic,
      .delay_seconds = delay_seconds,
      .source = saw_traffic ? "google_maps" : "",
  };
}

WeatherImpactEstimate EstimateWeatherImpact(const WeatherForecastOptions& options,
                                            const std::size_t stop_count,
                                            const int baseline_duration_seconds) {
  const int normalized_stop_count = ClampToInt(static_cast<long long>(std::min<std::size_t>(
      stop_count, static_cast<std::size_t>(std::numeric_limits<int>::max()))));
  const int normalized_baseline_seconds = std::max(baseline_duration_seconds, 0);
  const int configured_delay_per_stop =
      options.enabled ? std::max(options.weather_delay_seconds_per_stop, 0) : 0;
  const int weather_delay_seconds =
      ClampToInt(static_cast<long long>(configured_delay_per_stop) * normalized_stop_count);
  const int percent_threshold_seconds = ClampToInt(static_cast<long long>(
      std::ceil(static_cast<double>(normalized_baseline_seconds) *
                (std::max(options.reoptimize_threshold_percent, 0.0) / 100.0))));
  const int threshold_seconds =
      std::max(std::max(options.reoptimize_threshold_seconds, 0), percent_threshold_seconds);

  return WeatherImpactEstimate{
      .stop_count = normalized_stop_count,
      .baseline_duration_seconds = normalized_baseline_seconds,
      .baseline_route_duration_seconds = normalized_baseline_seconds,
      .delay_seconds_per_stop = configured_delay_per_stop,
      .weather_delay_seconds = weather_delay_seconds,
      .weather_adjusted_duration_seconds = normalized_baseline_seconds + weather_delay_seconds,
      .reoptimize_threshold_seconds = threshold_seconds,
      .should_reoptimize = weather_delay_seconds > 0 && weather_delay_seconds >= threshold_seconds,
      .source = options.enabled ? "fixed_delay" : "disabled",
      .planned_start_time = std::nullopt,
      .estimated_finish_time = std::nullopt,
  };
}

TrafficImpact EstimateTrafficImpact(const TrafficForecastOptions& options,
                                    const int baseline_duration_seconds,
                                    const int traffic_delay_seconds, std::string source) {
  const int normalized_baseline_seconds = std::max(baseline_duration_seconds, 0);
  const int normalized_delay_seconds = options.enabled ? std::max(traffic_delay_seconds, 0) : 0;
  const int percent_threshold_seconds = ClampToInt(static_cast<long long>(
      std::ceil(static_cast<double>(normalized_baseline_seconds) *
                (std::max(options.reoptimize_threshold_percent, 0.0) / 100.0))));
  const int threshold_seconds =
      std::max(std::max(options.reoptimize_threshold_seconds, 0), percent_threshold_seconds);

  return TrafficImpact{
      .baseline_duration_seconds = normalized_baseline_seconds,
      .traffic_delay_seconds = normalized_delay_seconds,
      .traffic_adjusted_duration_seconds = normalized_baseline_seconds + normalized_delay_seconds,
      .reoptimize_threshold_seconds = threshold_seconds,
      .should_reoptimize =
          normalized_delay_seconds > 0 && normalized_delay_seconds >= threshold_seconds,
      .source = options.enabled ? std::move(source) : "disabled",
  };
}

WeatherImpactEstimate EstimateRouteWeatherImpact(const WeatherForecastOptions& options,
                                                 const OptimizeRequestInput& input,
                                                 const int baseline_duration_seconds) {
  WeatherForecastOptions effective_options = options;
  WeatherImpactEstimate impact =
      EstimateWeatherImpact(effective_options, input.jobs.size(), baseline_duration_seconds);
  const std::optional<std::chrono::sys_seconds> route_start_time = ReadRouteStartTime(input);
  SetRouteTimes(route_start_time, impact);
  const OpenWeatherDelayEstimate openweather = FetchOpenWeatherDelayEstimate(
      effective_options, Coordinate{.lon = input.depot_lon, .lat = input.depot_lat},
      route_start_time, baseline_duration_seconds);
  if (openweather.available) {
    effective_options.weather_delay_seconds_per_stop = openweather.delay_seconds_per_stop;
    impact = EstimateWeatherImpact(effective_options, input.jobs.size(), baseline_duration_seconds);
    impact.source = openweather.source;
    SetRouteTimes(route_start_time, impact);
  }

  return impact;
}

std::optional<std::chrono::sys_seconds> ReadRouteStartTime(const OptimizeRequestInput& input) {
  std::optional<std::chrono::sys_seconds> planned_start;
  for (const VehicleInput& vehicle : input.vehicles) {
    if (!vehicle.time_window.has_value()) {
      continue;
    }
    if (!planned_start.has_value() || vehicle.time_window->start < *planned_start) {
      planned_start = vehicle.time_window->start;
    }
  }

  return planned_start;
}

std::optional<int> ReadVroomDuration(const Json::Value& vroom_output) {
  const Json::Value& duration = vroom_output["summary"]["duration"];
  if (!duration.isNumeric()) {
    return std::nullopt;
  }

  const double raw_duration = duration.asDouble();
  if (raw_duration < 0.0 || raw_duration > static_cast<double>(std::numeric_limits<int>::max())) {
    return std::nullopt;
  }

  return static_cast<int>(std::ceil(raw_duration));
}

WeatherImpactEstimate RecalculateWeatherImpact(const WeatherForecastOptions& options,
                                               const OptimizeRequestInput& input,
                                               const Json::Value& vroom_output) {
  // Callers choose whether OpenWeather may be queried by passing or clearing the API key.
  const std::optional<int> summary_duration = ReadVroomDuration(vroom_output);
  if (!summary_duration.has_value()) {
    return EstimateRouteWeatherImpact(options, input, 0);
  }

  return EstimateRouteWeatherImpact(options, input, *summary_duration);
}

std::string BuildWeatherAdjustedVroomInputText(const OptimizeRequestInput& input,
                                               const WeatherImpactEstimate& impact) {
  // Weather delay time so VROOM can still decide the route order before dispatch.
  return BuildVroomInputText(input, impact.should_reoptimize ? impact.delay_seconds_per_stop : 0);
}

Json::Value BuildTrafficAdjustedVroomInput(const OptimizeRequestInput& input,
                                           const WeatherImpactEstimate& weather,
                                           const TrafficImpact& traffic,
                                           const Json::Value& vroom_output) {
  Json::Value payload =
      deliveryoptimizer::adapters::ParseJsonText(BuildWeatherAdjustedVroomInputText(input, weather))
          .value_or(Json::Value{Json::objectValue});
  if (!traffic.should_reoptimize || input.jobs.empty()) {
    return payload;
  }

  const std::vector<std::uint64_t> job_ids = ReadPayloadJobIds(payload);
  const std::vector<int> traffic_delays =
      BuildWeightedTrafficDelays(vroom_output, job_ids, traffic.traffic_delay_seconds);
  for (Json::ArrayIndex index = 0; index < payload["jobs"].size(); ++index) {
    Json::Value& job = payload["jobs"][index];
    const int current_service = job["service"].isInt() ? job["service"].asInt() : 0;
    job["service"] = current_service + traffic_delays[static_cast<std::size_t>(index)];
  }

  return payload;
}

Json::Value BuildWeatherForecastAnnotation(const WeatherForecastOptions& options,
                                           const WeatherImpactEstimate& impact) {
  Json::Value forecast{Json::objectValue};
  forecast["status"] = options.enabled ? "evaluated" : "disabled";
  forecast["provider"] = impact.source;
  forecast["stop_count"] = impact.stop_count;
  forecast["baseline_route_duration_seconds"] = impact.baseline_route_duration_seconds;
  forecast["weather_delay_seconds"] = impact.weather_delay_seconds;
  forecast["weather_adjusted_duration_seconds"] = impact.weather_adjusted_duration_seconds;
  forecast["reoptimize_threshold_seconds"] = impact.reoptimize_threshold_seconds;
  if (impact.planned_start_time.has_value()) {
    forecast["planned_start_time"] =
        static_cast<Json::Int64>(impact.planned_start_time->time_since_epoch().count());
  }
  if (impact.estimated_finish_time.has_value()) {
    forecast["estimated_finish_time"] =
        static_cast<Json::Int64>(impact.estimated_finish_time->time_since_epoch().count());
  }

  Json::Value reoptimization{Json::objectValue};
  reoptimization["applied"] = impact.should_reoptimize;
  reoptimization["reason"] = impact.should_reoptimize ? "weather_delay_crossed_threshold"
                                                      : "weather_delay_below_threshold";
  forecast["reoptimization"] = std::move(reoptimization);

  return forecast;
}

void AddTrafficForecast(Json::Value& forecast, const TrafficForecastOptions& options,
                        const TrafficImpact& impact) {
  Json::Value traffic{Json::objectValue};
  traffic["status"] = options.enabled ? "evaluated" : "disabled";
  traffic["provider"] = impact.source;
  traffic["baseline_duration_seconds"] = impact.baseline_duration_seconds;
  traffic["traffic_delay_seconds"] = impact.traffic_delay_seconds;
  traffic["traffic_adjusted_duration_seconds"] = impact.traffic_adjusted_duration_seconds;
  traffic["reoptimize_threshold_seconds"] = impact.reoptimize_threshold_seconds;

  Json::Value reoptimization{Json::objectValue};
  reoptimization["applied"] = impact.should_reoptimize;
  reoptimization["reason"] = impact.should_reoptimize ? "traffic_delay_crossed_threshold"
                                                      : "traffic_delay_below_threshold";
  traffic["reoptimization"] = std::move(reoptimization);
  forecast["traffic"] = std::move(traffic);
}

TrafficPostprocessPlan PrepareTrafficPostprocessing(const TrafficForecastOptions& options,
                                                    const OptimizeRequestInput& input,
                                                    const WeatherImpactEstimate& weather,
                                                    const Json::Value& route_output,
                                                    Json::Value& forecast) {
  const TrafficDelayEstimate traffic_delay =
      ReadRouteTraffic(options, route_output, ReadRouteStartTime(input));
  TrafficImpact impact = EstimateTrafficImpact(options, ReadVroomDuration(route_output).value_or(0),
                                               traffic_delay.delay_seconds, traffic_delay.source);
  AddTrafficForecast(forecast, options, impact);

  std::optional<Json::Value> adjusted_vroom_input;
  if (impact.should_reoptimize) {
    adjusted_vroom_input = BuildTrafficAdjustedVroomInput(input, weather, impact, route_output);
  }
  return TrafficPostprocessPlan{
      .impact = std::move(impact),
      .adjusted_vroom_input = std::move(adjusted_vroom_input),
  };
}

} // namespace deliveryoptimizer::api

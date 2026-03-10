#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <charconv>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <drogon/drogon.h>
#include <iostream>
#include <optional>
#include <string_view>
#include <system_error>
#include <thread>
#include <utility>

namespace {

constexpr std::uint16_t kDefaultPort = 8080;

[[nodiscard]] std::optional<std::uint16_t> ResolveListenPort() {
  const char* raw_port = std::getenv("DELIVERYOPTIMIZER_PORT");
  if (raw_port == nullptr || raw_port[0] == '\0') {
    return kDefaultPort;
  }

  const std::string_view port_text(raw_port);
  int parsed_port = 0;
  const auto [end_ptr, error] =
      std::from_chars(port_text.data(), port_text.data() + port_text.size(), parsed_port);

  if (error != std::errc{} || end_ptr != port_text.data() + port_text.size() || parsed_port < 1 ||
      parsed_port > 65535) {
    std::cerr << "Invalid DELIVERYOPTIMIZER_PORT='" << raw_port
              << "'. Expected an integer in the range 1..65535.\n";
    return std::nullopt;
  }

  return static_cast<std::uint16_t>(parsed_port);
}

} // namespace

int main() {
  const auto port = ResolveListenPort();
  if (!port.has_value()) {
    return 1;
  }

  drogon::app().registerHandler(
      "/health", [](const drogon::HttpRequestPtr& /*request*/,
                    std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        Json::Value body;
        body["status"] = "ok";
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      });

  drogon::app().registerHandler(
      "/optimize",
      [](const drogon::HttpRequestPtr& request,
         std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const int deliveries_param = request->getOptionalParameter<int>("deliveries").value_or(1);
        const int vehicles_param = request->getOptionalParameter<int>("vehicles").value_or(1);

        if (deliveries_param < 0 || vehicles_param < 0) {
          Json::Value error_body;
          error_body["error"] =
              "Query parameters 'deliveries' and 'vehicles' must be non-negative integers.";
          auto response = drogon::HttpResponse::newHttpJsonResponse(error_body);
          response->setStatusCode(drogon::k400BadRequest);
          std::move(callback)(response);
          return;
        }

        const auto deliveries = static_cast<std::size_t>(deliveries_param);
        const auto vehicles = static_cast<std::size_t>(vehicles_param);

        Json::Value body;
        body["summary"] =
            deliveryoptimizer::adapters::RoutingFacade::Optimize(deliveries, vehicles);
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      },
      {drogon::Post});

  drogon::app().addListener("0.0.0.0", *port);
  const unsigned int detected_threads = std::thread::hardware_concurrency();
  const unsigned int thread_count = detected_threads == 0U ? 1U : detected_threads;
  drogon::app().setThreadNum(thread_count);
  drogon::app().run();

  return 0;
}

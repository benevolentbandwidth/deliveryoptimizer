#include "deliveryoptimizer/api/api_server.hpp"

#include "deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/health_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/osrm_proxy_endpoint.hpp"
#include "deliveryoptimizer/api/server_options.hpp"

#include <drogon/drogon.h>

namespace {

constexpr std::size_t kMaxRequestBodyBytes = 10U * 1024U * 1024U;

} // namespace

namespace deliveryoptimizer::api {

int RunApiServer() {
  auto& app = drogon::app();

  RegisterHealthEndpoint(app);
  RegisterOptimizeEndpoint(app);
  RegisterDeliveriesOptimizeEndpoint(app);
  RegisterOsrmProxyEndpoint(app);

  const auto options = LoadServerOptionsFromEnv();
  app.addListener("0.0.0.0", options.listen_port);
  app.setClientMaxBodySize(kMaxRequestBodyBytes);
  app.setThreadNum(options.worker_threads);
  app.run();

  return 0;
}

} // namespace deliveryoptimizer::api

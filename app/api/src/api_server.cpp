#include "deliveryoptimizer/api/api_server.hpp"

#include "deliveryoptimizer/api/endpoints/health_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/osrm_proxy_endpoint.hpp"
#include "deliveryoptimizer/api/server_options.hpp"

#include <drogon/drogon.h>

namespace deliveryoptimizer::api {

int RunApiServer() {
  auto& app = drogon::app();

  RegisterHealthEndpoint(app);
  RegisterOptimizeEndpoint(app);
  RegisterOsrmProxyEndpoint(app);

  const auto options = LoadServerOptionsFromEnv();
  app.addListener("0.0.0.0", options.listen_port);
  app.setThreadNum(options.worker_threads);
  app.run();

  return 0;
}

} // namespace deliveryoptimizer::api

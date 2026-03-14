#pragma once

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app);

} // namespace deliveryoptimizer::api

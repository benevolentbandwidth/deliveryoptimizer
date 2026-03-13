#pragma once

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

void RegisterOptimizeEndpoint(drogon::HttpAppFramework& app);

} // namespace deliveryoptimizer::api

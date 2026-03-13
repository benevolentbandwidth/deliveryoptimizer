#pragma once

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

void RegisterHealthEndpoint(drogon::HttpAppFramework& app);

} // namespace deliveryoptimizer::api

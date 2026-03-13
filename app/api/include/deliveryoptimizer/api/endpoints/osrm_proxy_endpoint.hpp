#pragma once

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

void RegisterOsrmProxyEndpoint(drogon::HttpAppFramework& app);

} // namespace deliveryoptimizer::api

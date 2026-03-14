#pragma once

#include <cstdlib>
#include <string>
#include <string_view>

namespace deliveryoptimizer::api {

[[nodiscard]] inline std::string ResolveEnvOrDefault(const char* key,
                                                     const std::string_view default_value) {
  const char* raw_value = std::getenv(key);
  if (raw_value == nullptr || *raw_value == '\0') {
    return std::string{default_value};
  }

  return std::string{raw_value};
}

[[nodiscard]] inline std::string
ResolveNormalizedUrlEnvOrDefault(const char* key, const std::string_view default_value) {
  std::string normalized_url = ResolveEnvOrDefault(key, default_value);
  if (!normalized_url.empty() && normalized_url.back() == '/') {
    normalized_url.pop_back();
  }

  if (normalized_url.empty()) {
    return std::string{default_value};
  }

  return normalized_url;
}

} // namespace deliveryoptimizer::api

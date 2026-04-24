#pragma once

#include <json/json.h>

#include <memory>
#include <optional>
#include <string>

namespace deliveryoptimizer::api::internal {

inline std::optional<Json::Value> ParseJsonText(const std::string& text) {
  Json::CharReaderBuilder builder;
  builder["collectComments"] = false;

  Json::Value root;
  JSONCPP_STRING errors;
  std::unique_ptr<Json::CharReader> reader{builder.newCharReader()};
  const char* begin = text.data();
  const char* end = begin + text.size();
  if (!reader->parse(begin, end, &root, &errors)) {
    return std::nullopt;
  }

  return root;
}

inline std::string RenderJson(const Json::Value& value) {
  Json::StreamWriterBuilder writer_builder;
  writer_builder["indentation"] = "";
  writer_builder["commentStyle"] = "None";
  return Json::writeString(writer_builder, value);
}

} // namespace deliveryoptimizer::api::internal

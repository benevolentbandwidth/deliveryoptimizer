from conan import ConanFile
from conan.tools.cmake import cmake_layout


class App(ConanFile):
    name = "app"
    version = "0.1.0"
    package_type = "application"
    required_conan_version = ">=2.0"

    settings = "os", "compiler", "build_type", "arch"
    generators = "CMakeToolchain", "CMakeDeps"
    default_options = {
        "drogon/*:with_postgres": True,
        "drogon/*:with_postgres_batch": True,
    }

    def requirements(self):
        self.requires("drogon/1.9.12")
        self.test_requires("gtest/1.14.0")

    def layout(self):
        cmake_layout(self)

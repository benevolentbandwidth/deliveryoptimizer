{
  description = "Delivery Optimizer backend development shell with a consistent Nix LLVM toolchain";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/f8573b9c935cfaa162dd62cc9e75ae2db86f85df";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f (
            import nixpkgs {
              inherit system;
            }
          )
        );
    in
    {
      devShells = forAllSystems (
        pkgs:
        let
          # On this pinned nixpkgs rev, pkgs.llvmPackages resolves to LLVM 21.1.8.
          llvm = pkgs.llvmPackages;
          clang = llvm.clang;
        in
        {
          default = pkgs.mkShell {
            packages = [
              clang
              llvm.clang-tools
              llvm.lld
              pkgs.ccache
              pkgs.cmake
              pkgs.conan
              pkgs.curl
              pkgs.docker
              pkgs.docker-compose
              pkgs.git
              pkgs.jq
              pkgs.ninja
              pkgs.pkg-config
              pkgs.postgresql
              pkgs.python3
            ];

            env = {
              CC = "${clang}/bin/clang";
              CXX = "${clang}/bin/clang++";
              CMAKE_GENERATOR = "Ninja";
            };

            shellHook = ''
              # Nix clang on Darwin does not always discover libc++ headers, so extract their include root from NIX_CFLAGS_COMPILE and add it to CPLUS_INCLUDE_PATH.
              if [ "$(uname -s)" = "Darwin" ] && [ -n "''${NIX_CFLAGS_COMPILE:-}" ]; then
                libcxx_include_root="$(
                  printf '%s\n' "$NIX_CFLAGS_COMPILE" | tr ' ' '\n' | awk '/libcxx/ && /\/include$/ { print; exit }'
                )"
                if [ -n "$libcxx_include_root" ] && [ -d "$libcxx_include_root/c++/v1" ]; then
                  export CPLUS_INCLUDE_PATH="$libcxx_include_root/c++/v1''${CPLUS_INCLUDE_PATH:+:$CPLUS_INCLUDE_PATH}"
                fi
              fi
              export DELIVERYOPTIMIZER_NIX_LLVM=1
              echo "Entered deliveryoptimizer backend dev shell."
              echo "Compiler: $(command -v clang++)"
              echo "Next step: conan profile detect --force && cmake --preset conan-release"
            '';
          };
        }
      );

      formatter = forAllSystems (pkgs: pkgs.nixfmt-rfc-style);
    };
}

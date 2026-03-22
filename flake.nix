{
  description = "Real-time terminal dashboard for monitoring AI coding agent sessions";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "agenttop";
          version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
          src = ./.;
          npmDepsHash = "";
          nodejs = pkgs.nodejs_20;
          meta = {
            description = "Real-time terminal dashboard for monitoring AI coding agent sessions";
            license = pkgs.lib.licenses.mit;
            mainProgram = "agenttop";
          };
        };
      }
    );
}

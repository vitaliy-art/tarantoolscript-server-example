# TarantoolScript server example

This project is a simple example of [Tarantool](https://www.tarantool.io/en/) HTTP-server, written on TypesScript with [TypescriptToLua](https://typescripttolua.github.io/) and [TarantoolScript](https://github.com/vitaliy-art/tarantoolscript). It is intended to demonstrate the possibility of writing Tarantool Lua scripts on TypeScript.

## Build

To build this project, you need to install first [Node.js](https://nodejs.org/). After installation just run in console:

```bash
npm run build
```

## Run

After successfully building all Lua files will be placed into `./build/app` directory. You can use this files to run them with [tt CLI utility](https://www.tarantool.io/en/doc/latest/reference/tooling/tt_cli/) or with Tarantool directly.

### Lua dependencies

Before launch Lua script, make sure you have installed [http](https://github.com/tarantool/http) package.

## Tests

For run tests, you need to install first [luatest](https://github.com/tarantool/luatest) and optionally `luacov`. To launch tests run in console:

```bash
npm run test
```

or

```bash
npm run test-coverage
```

## Devcontainer

This project includes [VSCode DevContainer](https://code.visualstudio.com/docs/devcontainers/tutorial) configurations, so you can just open it in development container which includes all needed dependencies.

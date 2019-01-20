# event-source-shim

[![npm version](https://img.shields.io/npm/v/event-source-shim.svg)](https://www.npmjs.com/package/event-source-shim)
[![Downloads/month](https://img.shields.io/npm/dm/event-source-shim.svg)](http://www.npmtrends.com/event-source-shim)
[![Build Status](https://travis-ci.com/mysticatea/event-source-shim.svg?branch=master)](https://travis-ci.com/mysticatea/event-source-shim)
[![Coverage Status](https://codecov.io/gh/mysticatea/event-source-shim/branch/master/graph/badge.svg)](https://codecov.io/gh/mysticatea/event-source-shim)
[![Dependency Status](https://david-dm.org/mysticatea/event-source-shim.svg)](https://david-dm.org/mysticatea/event-source-shim)

An implementation of [WHATWG EventSource interface](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface).

You can support Server-sent events on also Internet Explorer and Edge.
This package includes type definition for TypeScript.

## 💿 Installation

Use [npm] or a compatible tool to install.

```bash
npm install event-source-shim
```

## 📖 Usage

Use a bundler such as [webpack]. You have to configure the bundler to transpile this package and [event-target-shim] package to ES5 from ES2015 for Internet Explorer.

For example:

```js
module.exports = {
    //....
    module: {
        rules: [
            {
                test: /\.mjs$/u,
                include: [
                    path.resolve(__dirname, "node_modules/event-source-shim"),
                    path.resolve(__dirname, "node_modules/event-target-shim"),
                ],
                loader: "babel-loader", // with @babel/preset-env.
            },
        ]
    },
    //....
}
```

## 📚 API References

### § `EventSource` class

This is same as standard. See [MDN page of EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

```ts
import { EventSource } from "event-source-shim"

const source = new EventSource("/events")
source.addEventListener("message", event => {
    console.log(event.data)
})
```

### § `setDefaultReconnectionTime(value: number): void` function

In the specification, the interval of reestablishing the connection is a user-agent-defined value (see [reconnection time](https://html.spec.whatwg.org/multipage/server-sent-events.html#concept-event-stream-reconnection-time)). As following the recommendation in the spec, this package set four seconds to the reconnection time by default. But you can configure the reconnection time with an arbitrary value.

```ts
import { setDefaultReconnectionTime } from "event-source-shim"

setDefaultReconnectionTime(10000) // 10sec.
```

### § `setMaxBufferSize(value: number): void` function

This package uses `XMLHttpRequest` and that `onprogress` event to implement `EventSource` class. This means that it must disconnect and reestablish the connection at random intervals in order to avoid memory leaks. This package does the reconnecting when the length of `XMLHttpRequest#responseText` gets greater than configured max buffer size. The max buffer size is 64KB by default. But you can configure the max buffer size with an arbitrary value.

```ts
import { setMaxBufferSize } from "event-source-shim"

setMaxBufferSize(256 * 1024) // 256KB.
```

### § `setReconnectionTimeIncreasingRate(value: number): void` function

The spec allows additional wait time between reestablishing the connection.

> Optionally, wait some more. In particular, if the previous attempt failed, then user agents might introduce an exponential backoff delay to avoid overloading a potentially already overloaded server. Alternatively, if the operating system has reported that there is no network connectivity, user agents might wait for the operating system to announce that the network connection has returned before retrying.
>
> https://html.spec.whatwg.org/multipage/server-sent-events.html#reestablish-the-connection

This package multiplies the reconnection time by the configured increasing rate on every disconnection. The increasing rate is `1.5` by default. But you can configure the increasing rate with an arbitrary value.

```ts
import { setReconnectionTimeIncreasingRate } from "event-source-shim"

setReconnectionTimeIncreasingRate(2.0) // x2 on every failure. E.g., 4sec → 8sec → 16sec → ....
```

## ⚠️ Known Limitations

- Reconnecting happens at random intervals in order to clear `XMLHttpRequest#responseText`.
- `MessageEvent#origin` is not supported on Internet Explorer because `XMLHttpRequest#responseURL` is not supported.

## 📰 Release notes

- https://github.com/mysticatea/event-source-shim/releases

## ❤️ Contributions

Contributing is always welcome!

Please use GitHub issues and pull requests.

### Development tools

- `npm run build` generates files into `dist` directory.
- `npm run clean` removes temporary files.
- `npm run coverage` opens the coverage report the last `npm test` command generated.
- `npm run lint` runs ESLint.
- `npm test` runs tests.
- `npm run watch` runs tests on each file edits.

[event-target-shim]: https://www.npmjs.com/package/event-target-shim
[npm]: https://www.npmjs.com/
[Webpack]: https://webpack.js.org/

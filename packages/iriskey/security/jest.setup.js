/**
 * jsdom does not implement the Fetch API classes that `next/server` needs at
 * import time. Node 18+ provides them natively, so copy them onto the jsdom
 * global before any test module loads.
 */
const { TextDecoder, TextEncoder } = require('node:util');
const {
  ReadableStream,
  WritableStream,
  TransformStream,
} = require('node:stream/web');
const { MessagePort, MessageChannel } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');

// undici needs these itself, so they must land before it is required.
Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  WritableStream,
  TransformStream,
  MessagePort,
  MessageChannel,
  performance,
});

const { Request, Response, Headers, FormData, fetch } = require('undici');

Object.assign(globalThis, { Request, Response, Headers, FormData, fetch });

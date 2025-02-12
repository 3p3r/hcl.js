/// <reference path="./types.d.ts" />

import path from "path";
import { Writable } from "stream";
import { randomFillSync } from "crypto";

import memfs from "memfs";
import atob from "atob-lite";
import IsoWASI from "wasi-js";
import memoize from "lodash/memoize";
import type Parser from "tree-sitter";
import type { WASIBindings } from "wasi-js";
import { type IFsWithVolume, Volume } from "memfs";

import * as _TreeSitter from "./tree-sitter-hcl/docs/vendor/tree-sitter.js";
// import * as _TreeSitter from "web-tree-sitter";

// @ts-expect-error - handled by webpack loader
import HCL2JSON_WASM_BASE64 from "./hcl2json.wasm";
// @ts-expect-error - handled by webpack loader
import TREE_SITTER_WASM_BASE64 from "./tree-sitter.wasm";
// @ts-expect-error - handled by webpack loader
import TREE_SITTER_HCL_WASM_BASE64 from "./tree-sitter-hcl.wasm";

function decodeWasmFromBase64String(encoded: string) {
  const binaryString = atob(encoded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const treeSitterHcl = memoize(async (): Promise<Parser> => {
  // const wasmBinary1 = await fs.promises.readFile(path.join(__dirname, "tree-sitter.wasm"));
  const wasmBinary1 = decodeWasmFromBase64String(TREE_SITTER_WASM_BASE64);
  await _TreeSitter.default.init({ wasmBinary: wasmBinary1 });
  // const wasmBinary2 = await fs.promises.readFile(path.join(__dirname, "tree-sitter-hcl.wasm"));
  const wasmBinary2 = decodeWasmFromBase64String(TREE_SITTER_HCL_WASM_BASE64);
  const HCL = await _TreeSitter.default.Language.load(Buffer.from(wasmBinary2));
  const _parser = new _TreeSitter.default();
  _parser.setLanguage(HCL);
  return _parser;
});

const bindings: () => Partial<WASIBindings> = () => ({
  // @ts-expect-error
  hrtime: Date.now,
  exit(code: number) {
    this.exitCode = code;
  },
  kill(signal: string) {
    this.exitCode = signal;
  },
  randomFillSync,
  isTTY: () => true,
  path,
});

export async function hcl2json(sourceCode: string): Promise<object> {
  const volume = { ...memfs.fs, ...new Volume() } as IFsWithVolume;
  volume.mkdirSync("/tmp", { recursive: true });
  volume.writeFileSync("/tmp/input.tf", sourceCode);
  const output = [] as string[];
  const stdout = new Writable({
    write(chunk, encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });
  const stderr = new Writable();
  const wasi = new IsoWASI({
    bindings: { ...bindings(), fs: volume } as WASIBindings,
    preopens: { ".": "/tmp" },
    args: ["hcl2json", "input.tf"],
    env: process.env,
    sendStdout: (buf) => stdout.write(buf),
    sendStderr: (buf) => stderr.write(buf),
    getStdin() {
      return Buffer.from("\n");
    },
  });
  const importObject = {
    wasi_snapshot_preview1: wasi.wasiImport,
    wasi_unstable: wasi.wasiImport,
    wasi: wasi.wasiImport,
  };
  // const wasmBinary = await fs.promises.readFile(path.join(__dirname, "hcl2json.wasm"));
  const wasmBinary = decodeWasmFromBase64String(HCL2JSON_WASM_BASE64);
  const module = await WebAssembly.compile(wasmBinary);
  const instance = await WebAssembly.instantiate(module, importObject);
  wasi.start(instance);
  const raw = JSON.parse(output.join("").trim());
  return raw;
}

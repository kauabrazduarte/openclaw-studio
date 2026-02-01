import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  deleteDirRecursiveIfExists,
  deleteFileIfExists,
  ensureDir,
  ensureFile,
} from "./fs.server";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe("fs.server", () => {
  it("ensureDir creates directories and throws when path exists as a file", () => {
    const root = makeTempDir("ensureDir");
    const dir = path.join(root, "a", "b");

    ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);

    const filePath = path.join(root, "file.txt");
    fs.writeFileSync(filePath, "hi", "utf8");
    expect(() => ensureDir(filePath)).toThrow(/not a directory/i);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it("ensureFile creates missing files and throws when path exists as a directory", () => {
    const root = makeTempDir("ensureFile");
    const filePath = path.join(root, "x.txt");

    ensureFile(filePath, "hello");
    expect(fs.readFileSync(filePath, "utf8")).toBe("hello");

    const dirPath = path.join(root, "dir");
    fs.mkdirSync(dirPath);
    expect(() => ensureFile(dirPath, "nope")).toThrow(/not a file/i);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it("deleteFileIfExists deletes a file and no-ops when missing", () => {
    const root = makeTempDir("deleteFileIfExists");
    const filePath = path.join(root, "x.txt");

    deleteFileIfExists(filePath);
    expect(fs.existsSync(filePath)).toBe(false);

    fs.writeFileSync(filePath, "hi", "utf8");
    expect(fs.existsSync(filePath)).toBe(true);

    deleteFileIfExists(filePath);
    expect(fs.existsSync(filePath)).toBe(false);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it("deleteDirRecursiveIfExists deletes directories and throws on non-directory", () => {
    const root = makeTempDir("deleteDirRecursiveIfExists");

    const missing = path.join(root, "missing");
    expect(deleteDirRecursiveIfExists(missing).deleted).toBe(false);

    const dirPath = path.join(root, "dir");
    fs.mkdirSync(dirPath);
    fs.writeFileSync(path.join(dirPath, "a.txt"), "a", "utf8");
    expect(deleteDirRecursiveIfExists(dirPath).deleted).toBe(true);
    expect(fs.existsSync(dirPath)).toBe(false);

    const filePath = path.join(root, "file.txt");
    fs.writeFileSync(filePath, "hi", "utf8");
    expect(() => deleteDirRecursiveIfExists(filePath)).toThrow(/not a directory/i);

    fs.rmSync(root, { recursive: true, force: true });
  });
});

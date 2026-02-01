import fs from "node:fs";

export const ensureDir = (dirPath: string) => {
  if (fs.existsSync(dirPath)) {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`${dirPath} exists and is not a directory.`);
    }
    return;
  }
  fs.mkdirSync(dirPath, { recursive: true });
};

export const assertIsFile = (filePath: string, label?: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label ?? filePath} does not exist.`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label ?? filePath} exists but is not a file.`);
  }
};

export const assertIsDir = (dirPath: string, label?: string) => {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${label ?? dirPath} does not exist.`);
  }
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`${label ?? dirPath} exists but is not a directory.`);
  }
};

export const ensureFile = (filePath: string, contents: string) => {
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new Error(`${filePath} exists but is not a file.`);
    }
    return;
  }
  fs.writeFileSync(filePath, contents, "utf8");
};

export const deleteFileIfExists = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return;
  }
  fs.rmSync(filePath);
};

export const deleteDirRecursiveIfExists = (dirPath: string): { deleted: boolean } => {
  if (!fs.existsSync(dirPath)) {
    return { deleted: false };
  }
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }
  fs.rmSync(dirPath, { recursive: true, force: false });
  return { deleted: true };
};

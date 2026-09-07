import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";

import test from "@tossplace/pos-plugin-test"; // default import

// ESM에서 __dirname, require 대체
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ESM에서는 export default로 내보내야 함
const config = test.createWebpackConfig(
    require(path.join(__dirname, "package.json"))
);
// 검수 권고(6): 기본 프로파일이 development(eval devtool, 350KB)라 프로덕션으로 강제
config.mode = "production";
config.devtool = false;
export default config;

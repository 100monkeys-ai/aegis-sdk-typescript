/**
 * The Node lines this SDK is built and tested on, declared once.
 *
 * `.nvmrc` holds the Node major version the SDK is built on. `engines.node`
 * in package.json names the lowest Node line users may run it on. CI tests
 * on both, as a matrix. Every place that names a Node version must agree
 * with those two, or this test fails:
 *
 * - every `actions/setup-node` step reads `.nvmrc`, except the test job,
 *   which runs the matrix;
 * - the matrix holds exactly the engines floor and the `.nvmrc` line;
 * - `engines.node` and `@types/node` in package.json and the lockfile.
 *
 * Before this test CI built on Node 20, which is past its end of life, the
 * audit ran on Node 22, the types described Node 25 and nothing declared
 * which Node the SDK supports.
 */
import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const nvmrc = read(".nvmrc");
const major = nvmrc.trim();
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const floor = String(pkg.engines?.node ?? "").replace(/^>=/, "");

type Step = { uses?: string; with?: Record<string, unknown> };
type Job = { strategy?: { matrix?: Record<string, unknown> }; steps?: Step[] };

describe("the Node lines", () => {
  it(".nvmrc holds a bare major version and nothing else", () => {
    expect(nvmrc).toMatch(/^\d+\n$/);
  });

  it("engines.node names a lowest major, at or below .nvmrc", () => {
    expect(pkg.engines.node).toMatch(/^>=\d+$/);
    expect(lock.packages[""].engines.node).toBe(pkg.engines.node);
    expect(Number(floor)).toBeLessThanOrEqual(Number(major));
  });

  it("every setup-node step reads .nvmrc, and the test matrix holds the floor and .nvmrc", () => {
    const dir = path.join(root, ".github/workflows");
    let steps = 0;
    let matrices = 0;
    for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
      const wf = parse(readFileSync(path.join(dir, file), "utf8")) as {
        jobs?: Record<string, Job>;
      };
      for (const [name, job] of Object.entries(wf.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (!step.uses?.startsWith("actions/setup-node@")) continue;
          steps++;
          const where = `${file} ${name}`;
          if (step.with?.["node-version"] !== undefined) {
            expect(`${where}: ${step.with["node-version"]}`).toBe(
              `${where}: \${{ matrix.node }}`,
            );
            matrices++;
            expect(job.strategy?.matrix?.node).toEqual([...new Set([floor, major])]);
            expect(step.with["node-version-file"]).toBeUndefined();
          } else {
            expect(`${where}: ${step.with?.["node-version-file"]}`).toBe(`${where}: .nvmrc`);
          }
        }
      }
    }
    // ci.yml has two jobs that set up Node, npm-publish.yml two and
    // security.yml one; ci.yml's test job is the one matrix.
    expect(steps).toBe(5);
    expect(matrices).toBe(1);
  });

  it("@types/node describes the .nvmrc major", () => {
    const range = pkg.devDependencies["@types/node"] as string;
    expect(range).toMatch(new RegExp(`^\\^${major}\\.\\d+\\.\\d+$`));
    expect(lock.packages[""].devDependencies["@types/node"]).toBe(range);
    const resolved = lock.packages["node_modules/@types/node"].version as string;
    expect(resolved.split(".")[0]).toBe(major);
  });
});

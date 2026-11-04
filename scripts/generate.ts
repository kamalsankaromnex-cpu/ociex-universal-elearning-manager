// Official, version-matched Prisma generator API avoids unrelated native CLI downloads.
import { getGenerators } from "@prisma/internals";
import { PrismaClientJsGenerator } from "@prisma/client-generator-js";
async function main() {
  const generators = await getGenerators({
    schemaPath: "prisma/schema.prisma",
    registry: {
      "prisma-client-js": {
        type: "in-process",
        generator: new PrismaClientJsGenerator({ cliCommand: "prisma" }),
      },
    },
    skipDownload: true,
    cliCommand: "prisma",
  });
  try {
    for (const generator of generators) await generator.generate();
    console.log("Prisma JavaScript client generated.");
  } finally {
    for (const generator of generators) generator.stop();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

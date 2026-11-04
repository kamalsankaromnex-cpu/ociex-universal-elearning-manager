import libxml from "libxmljs2";
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { ScormVersion } from "../scorm/types";
export function validateManifest(xml: string, version: ScormVersion) {
  const dir = resolve(`vendor/scorm/${version}`);
  const imports =
    version === "1.2"
      ? [
          [
            "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
            "imscp_rootv1p1p2.xsd",
          ],
          ["http://www.adlnet.org/xsd/adlcp_rootv1p2", "adlcp_rootv1p2.xsd"],
        ]
      : [
          ["http://www.imsglobal.org/xsd/imscp_v1p1", "imscp_v1p1.xsd"],
          ["http://www.adlnet.org/xsd/adlcp_v1p3", "adlcp_v1p3.xsd"],
          ["http://www.adlnet.org/xsd/adlseq_v1p3", "adlseq_v1p3.xsd"],
          ["http://www.adlnet.org/xsd/adlnav_v1p3", "adlnav_v1p3.xsd"],
          ["http://www.imsglobal.org/xsd/imsss", "imsss_v1p0.xsd"],
        ];
  for (const [, name] of imports) readFileSync(join(dir, name));
  const wrapper = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">${imports.map(([ns, file]) => `<xs:import namespace="${ns}" schemaLocation="${pathToFileURL(join(dir, file)).href}"/>`).join("")}</xs:schema>`;
  const doc = libxml.parseXml(xml, { nonet: true }),
    schema = libxml.parseXml(wrapper, {
      nonet: true,
      baseUrl: pathToFileURL(join(dir, "validation.xsd")).href,
    });
  const valid = doc.validate(schema);
  return { valid, errors: doc.validationErrors.map((e) => e.message.trim()) };
}

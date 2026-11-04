export function xml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
function resources(files: string[], type: string) {
  return `<resources><resource identifier="RES_LESSON" type="webcontent" ${type} href="index.html">${files.map((f) => `<file href="${xml(f)}"/>`).join("")}</resource></resources>`;
}
export class ManifestGenerator12 {
  generate(title: string, id: string, files: string[]) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="PKG_${id}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="ORG"><organization identifier="ORG"><title>${xml(title)}</title><item identifier="ITEM_LESSON" identifierref="RES_LESSON" isvisible="true"><title>${xml(title)}</title></item></organization></organizations>${resources(files, 'adlcp:scormtype="sco"')}</manifest>`;
  }
}
export class ManifestGenerator2004 {
  generate(title: string, id: string, files: string[]) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="PKG_${id}" version="1.0" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3" xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3" xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3" xmlns:imsss="http://www.imsglobal.org/xsd/imsss" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd"><metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata><organizations default="ORG"><organization identifier="ORG" structure="hierarchical" adlseq:objectivesGlobalToSystem="false"><title>${xml(title)}</title><item identifier="ITEM_LESSON" identifierref="RES_LESSON" isvisible="true"><title>${xml(title)}</title><imsss:sequencing><imsss:objectives><imsss:primaryObjective objectiveID="course_objective" satisfiedByMeasure="false"/></imsss:objectives><imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/></imsss:sequencing></item><imsss:sequencing><imsss:controlMode choice="true" flow="true"/></imsss:sequencing></organization></organizations>${resources(files, 'adlcp:scormType="sco"')}</manifest>`;
  }
}

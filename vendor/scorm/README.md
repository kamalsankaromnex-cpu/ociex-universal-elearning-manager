# SCORM schema provenance

These are the distributed ADL/IMS SCORM 1.2 and SCORM **2004 4th Edition** schema distributions bundled in `simple-scorm-packager@0.2.7` (MIT packaging license, retained in SOURCE-LICENSE). Individual XML files retain their original copyright/license notices. The 3rd Edition directory is deliberately not used.

Source: https://registry.npmjs.org/simple-scorm-packager/-/simple-scorm-packager-0.2.7.tgz
Npm tarball SHA-1: d5c95f55b9a809a6bcc6347b51c94b204f5559cf

Downloaded with npm's registry integrity verification. Full recursive schema imports and DTD resources are packaged locally. A package validation test validates the generated manifest with these schemas and rejects a deliberately invalid manifest. This validates XML packaging, not ADL runtime certification or an external LMS launch.

## Compatibility correction

The legacy 1.2 `ims_xml.xsd` illegally bound the reserved XML namespace as the default namespace. That one unused default namespace declaration was removed to comply with Namespaces in XML (the XML namespace must be bound only to the `xml` prefix). All schema elements are already explicitly `xsd:`-qualified; target namespaces, types, attributes and constraints are unchanged. This is a parser-compatibility repair, not a permissive replacement schema. All other schema files remain byte-for-byte as distributed.

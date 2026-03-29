import { GHLClient } from "./client";
import { prisma } from "../db";

interface GHLCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  parentId?: string; // folder ID
}

export async function getCustomFields(
  client: GHLClient,
  locationId: string
): Promise<GHLCustomField[]> {
  const result = await client.get<{ customFields: GHLCustomField[] }>(
    `/locations/${locationId}/customFields`
  );
  return result.customFields || [];
}

export async function createCustomField(
  client: GHLClient,
  locationId: string,
  field: { name: string; dataType: string; model?: string; parentId?: string }
): Promise<GHLCustomField> {
  const result = await client.post<{ customField: GHLCustomField }>(
    `/locations/${locationId}/customFields`,
    { model: "contact", ...field }
  );
  return result.customField;
}

/**
 * Ensure all required custom fields exist for a connector.
 *
 * Creates fields with clean names (no "attr:" prefix, proper casing).
 * If a folder named after the connector already exists in GHL (manually created),
 * fields are placed inside it. Otherwise fields go to root level.
 *
 * Note: GHL's folder creation API (POST /custom-fields/folder) does NOT support
 * contact custom fields — only Custom Objects and Company. So we cannot
 * programmatically create folders for contacts. Users can create the folder
 * manually in GHL and we'll detect and use it.
 *
 * Returns a mapping of sourceFieldKey → GHL custom field ID.
 */
export async function ensureCustomFields(
  client: GHLClient,
  locationId: string,
  connectorId: string,
  connectorName: string,
  requiredFields: { key: string; name: string; dataType: string }[],
  preferredFolderId?: string | null
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};

  if (requiredFields.length === 0) return mapping;

  // Check DB cache first
  const cached = await prisma.customFieldMapping.findMany({
    where: { ghlLocationId: locationId, connectorId },
  });

  const cachedMap = new Map(cached.map((c) => [c.sourceFieldKey, c.ghlFieldId]));
  const uncached = requiredFields.filter((f) => !cachedMap.has(f.key));

  // Add cached entries to mapping
  for (const [key, fieldId] of cachedMap) {
    mapping[key] = fieldId;
  }

  if (uncached.length === 0) return mapping;

  // Fetch existing GHL custom fields
  const existingFields = await getCustomFields(client, locationId);

  // Use user-selected folder if provided, otherwise auto-detect.
  // Tries "Custom" first, then the connector name (e.g. "Podium") as fallback.
  // Folders appear as custom field entries with no dataType.
  let folderId: string | null = null;
  if (preferredFolderId) {
    // Verify the folder actually exists
    const folderExists = existingFields.some(
      (f) => f.id === preferredFolderId && (!f.dataType || f.dataType === "")
    );
    folderId = folderExists ? preferredFolderId : null;
  }
  if (!folderId) {
    const FOLDER_NAMES = ["custom", connectorName.toLowerCase()];
    const existingFolder = existingFields.find(
      (f) =>
        FOLDER_NAMES.includes(f.name.toLowerCase()) &&
        (!f.dataType || f.dataType === "")
    );
    folderId = existingFolder?.id || null;
  }

  // Create missing fields (inside folder if one exists, otherwise at root)
  for (const field of uncached) {
    // Check if field already exists by name (in folder or anywhere)
    const existing = existingFields.find(
      (f) =>
        f.name.toLowerCase() === field.name.toLowerCase() &&
        f.dataType && // Must be a real field, not a folder
        (folderId ? f.parentId === folderId : true)
    );

    let fieldId: string;
    if (existing) {
      fieldId = existing.id;
    } else {
      const payload: { name: string; dataType: string; model: string; parentId?: string } = {
        name: field.name,
        dataType: field.dataType || "TEXT",
        model: "contact",
      };
      if (folderId) payload.parentId = folderId;
      const created = await createCustomField(client, locationId, payload);
      fieldId = created.id;
    }

    // Cache in DB
    await prisma.customFieldMapping.upsert({
      where: {
        ghlLocationId_connectorId_sourceFieldKey: {
          ghlLocationId: locationId,
          connectorId,
          sourceFieldKey: field.key,
        },
      },
      update: { ghlFieldId: fieldId, ghlFolderId: folderId || "" },
      create: {
        ghlLocationId: locationId,
        connectorId,
        sourceFieldKey: field.key,
        ghlFieldId: fieldId,
        ghlFolderId: folderId || "",
      },
    });

    mapping[field.key] = fieldId;
  }

  return mapping;
}

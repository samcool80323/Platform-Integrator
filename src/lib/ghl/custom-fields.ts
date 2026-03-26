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
 * Create a custom field folder in GHL.
 * Folders are created WITHOUT a dataType — only name + model.
 * If this fails, returns null and fields will be created at top level.
 */
async function createFolder(
  client: GHLClient,
  locationId: string,
  name: string
): Promise<string | null> {
  try {
    const result = await client.post<{ customField?: { id: string } }>(
      `/locations/${locationId}/customFields`,
      { name, model: "contact" }
    );
    return result.customField?.id || null;
  } catch {
    return null;
  }
}

/**
 * Ensure all required custom fields exist for a connector.
 * Creates a folder named after the connector (e.g. "Podium") and puts
 * all custom fields inside it with clean names (e.g. "Opportunity Value").
 * Returns a mapping of sourceFieldKey → GHL custom field ID.
 */
export async function ensureCustomFields(
  client: GHLClient,
  locationId: string,
  connectorId: string,
  connectorName: string,
  requiredFields: { key: string; name: string; dataType: string }[]
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

  // Find or create the connector folder (e.g. "Podium")
  // Folders show up as custom fields with no dataType
  let folderId: string | null = null;

  const existingFolder = existingFields.find(
    (f) => f.name === connectorName && !f.dataType
  );

  if (existingFolder) {
    folderId = existingFolder.id;
  } else {
    folderId = await createFolder(client, locationId, connectorName);
  }

  // Create missing fields inside the folder
  for (const field of uncached) {
    // Check if field already exists by name (in folder or anywhere)
    const existing = existingFields.find(
      (f) => f.name === field.name && (folderId ? f.parentId === folderId : true)
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

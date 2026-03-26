import { GHLClient } from "./client";
import { prisma } from "../db";

interface GHLCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  parentId?: string; // folder ID
}

interface GHLCustomFieldFolder {
  id: string;
  name: string;
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

export async function getCustomFieldFolders(
  client: GHLClient,
  locationId: string
): Promise<GHLCustomFieldFolder[]> {
  // GHL doesn't have a dedicated folder endpoint; folders come with custom fields
  const fields = await getCustomFields(client, locationId);
  const folders = new Map<string, GHLCustomFieldFolder>();

  for (const field of fields) {
    if (field.parentId && !folders.has(field.parentId)) {
      folders.set(field.parentId, { id: field.parentId, name: "" });
    }
  }

  return Array.from(folders.values());
}

export async function createCustomFieldFolder(
  client: GHLClient,
  locationId: string,
  name: string
): Promise<GHLCustomFieldFolder | null> {
  // Try to create a folder group via the customFields endpoint.
  // GHL API support for folder creation varies — if it fails, return null
  // and fields will be created at the top level instead.
  try {
    const result = await client.post<{ customField?: GHLCustomFieldFolder }>(
      `/locations/${locationId}/customFields`,
      { name, dataType: "FOLDER", model: "contact" }
    );
    return result.customField || null;
  } catch {
    // Folder creation not supported or failed — fields will go to top level
    return null;
  }
}

/**
 * Ensure all required custom fields exist for a connector.
 * Creates folder + fields if they don't exist. Returns a mapping of
 * sourceFieldKey → GHL custom field ID.
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

  // Try to find or create folder — if folder creation fails, fields go top-level
  const folderName = `${connectorName} Fields`;
  let folder = existingFields.find(
    (f) => f.name === folderName && !f.dataType
  );

  let folderId: string | undefined;
  if (folder) {
    folderId = folder.id;
  } else {
    const newFolder = await createCustomFieldFolder(client, locationId, folderName);
    folderId = newFolder?.id;
  }

  // Create missing fields
  for (const field of uncached) {
    // Check if field already exists by name (in folder or top-level)
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

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
  field: { name: string; dataType: string; model?: string }
): Promise<GHLCustomField> {
  const result = await client.post<{ customField: GHLCustomField }>(
    `/locations/${locationId}/customFields`,
    { model: "contact", ...field }
  );
  return result.customField;
}

/**
 * Ensure all required custom fields exist for a connector.
 * Creates fields prefixed with connector name (e.g. "Podium - Birthday").
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

  // Fetch existing GHL custom fields to avoid duplicates
  const existingFields = await getCustomFields(client, locationId);

  // Create missing fields — prefixed with connector name for grouping
  for (const field of uncached) {
    const ghlFieldName = `${connectorName} - ${field.name}`;

    // Check if field already exists by name
    const existing = existingFields.find(
      (f) => f.name === ghlFieldName
    );

    let fieldId: string;
    if (existing) {
      fieldId = existing.id;
    } else {
      const created = await createCustomField(client, locationId, {
        name: ghlFieldName,
        dataType: field.dataType || "TEXT",
        model: "contact",
      });
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
      update: { ghlFieldId: fieldId, ghlFolderId: "" },
      create: {
        ghlLocationId: locationId,
        connectorId,
        sourceFieldKey: field.key,
        ghlFieldId: fieldId,
        ghlFolderId: "",
      },
    });

    mapping[field.key] = fieldId;
  }

  return mapping;
}

import type { FieldMapping, UniversalContact } from "../universal-model/types";
import type { GHLContact } from "../ghl/contacts";

/**
 * Apply field mappings to transform a UniversalContact into a GHL contact payload.
 */
export function applyFieldMappings(
  contact: UniversalContact,
  mappings: FieldMapping[],
  customFieldIdMap: Record<string, string> // sourceFieldKey → GHL custom field ID
): Partial<GHLContact> {
  const result: Record<string, unknown> = {};
  const customFieldValues: { id: string; field_value: unknown }[] = [];

  for (const mapping of mappings) {
    const rawValue = getSourceValue(contact, mapping.sourceField);
    if (rawValue == null) continue;

    const value = applyTransform(rawValue, mapping.transform);

    if (mapping.targetType === "standard") {
      result[mapping.targetField] = value;
    } else {
      // Custom field
      const ghlFieldId =
        customFieldIdMap[mapping.sourceField] ||
        customFieldIdMap[mapping.targetField.replace("custom:", "")];
      if (ghlFieldId) {
        customFieldValues.push({ id: ghlFieldId, field_value: value });
      }
    }
  }

  if (customFieldValues.length > 0) {
    result.customFields = customFieldValues;
  }

  // Always include tags if present
  const existingTags = Array.isArray(result.tags) ? result.tags.map(String) :
    typeof result.tags === "string" ? [result.tags] : [];
  const contactTags = contact.tags || [];
  const allTags = [...new Set([...existingTags, ...contactTags])];

  // Auto-add source platform tag so you can always tell where a contact came from
  if (contact.source) {
    const sourceTag = `imported-from-${contact.source}`;
    if (!allTags.includes(sourceTag)) allTags.push(sourceTag);
  }

  if (allTags.length > 0) {
    result.tags = allTags;
  }

  return result as Partial<GHLContact>;
}

function getSourceValue(
  contact: UniversalContact,
  sourceField: string
): unknown {
  // Check direct properties first
  const directMap: Record<string, unknown> = {
    name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    companyName: contact.companyName,
    website: contact.website,
    tags: contact.tags,
    "address.street": contact.address?.street,
    "address.city": contact.address?.city,
    "address.state": contact.address?.state,
    "address.postalCode": contact.address?.postalCode,
    "address.country": contact.address?.country,
  };

  if (sourceField in directMap) return directMap[sourceField];

  // Check custom fields
  if (sourceField in contact.customFields) {
    return contact.customFields[sourceField];
  }

  // Check raw data as fallback
  if (sourceField in contact.rawData) {
    return contact.rawData[sourceField];
  }

  return undefined;
}

function applyTransform(
  value: unknown,
  transform?: string
): unknown {
  if (!transform || transform === "none") return value;

  const str = String(value);
  switch (transform) {
    case "lowercase":
      return str.toLowerCase();
    case "uppercase":
      return str.toUpperCase();
    case "phone_format":
      // Strip non-digit characters, add +1 if missing country code
      const digits = str.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      return `+${digits}`;
    case "date_format":
      // Try to parse and return ISO date
      const date = new Date(str);
      return isNaN(date.getTime()) ? str : date.toISOString().split("T")[0];
    default:
      return value;
  }
}

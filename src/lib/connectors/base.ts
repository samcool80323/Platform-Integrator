import type { FieldMapping, FieldSchema } from "../universal-model/types";
import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "./types";

/**
 * GHL standard contact fields that source fields can map to.
 */
export const GHL_STANDARD_FIELDS: Record<string, string> = {
  name: "Full Name",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  address1: "Address Line 1",
  city: "City",
  state: "State",
  postalCode: "Postal / Zip Code",
  country: "Country",
  website: "Website",
  companyName: "Company Name",
  dateOfBirth: "Date of Birth",
  gender: "Gender",
  timezone: "Timezone",
  source: "Source",
  tags: "Tags",
  dnd: "Do Not Disturb",
};

/**
 * Infer field type from sample values.
 */
export function inferFieldType(
  values: unknown[]
): FieldSchema["type"] {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (nonNull.length === 0) return "text";

  const sample = nonNull[0];
  if (typeof sample === "boolean") return "boolean";
  if (typeof sample === "number") return "number";

  const str = String(sample);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return "date";
  if (/^https?:\/\//.test(str)) return "url";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return "email";
  if (/^\+?[\d\s()-]{7,}$/.test(str)) return "phone";

  return "text";
}

/**
 * Auto-map source fields to GHL standard fields using simple name matching.
 */
export function autoMapFields(sourceFields: FieldSchema[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const normMap: Record<string, string> = {};

  // Build normalized GHL field lookup
  for (const [key, label] of Object.entries(GHL_STANDARD_FIELDS)) {
    normMap[normalize(key)] = key;
    normMap[normalize(label)] = key;
  }

  // Common aliases
  const aliases: Record<string, string> = {
    name: "name",
    fullname: "name",
    full_name: "name",
    firstname: "firstName",
    first_name: "firstName",
    lastname: "lastName",
    last_name: "lastName",
    emailaddress: "email",
    email_address: "email",
    phonenumber: "phone",
    phone_number: "phone",
    mobile: "phone",
    cell: "phone",
    streetaddress: "address1",
    street_address: "address1",
    address: "address1",
    zip: "postalCode",
    zipcode: "postalCode",
    zip_code: "postalCode",
    postal_code: "postalCode",
    company: "companyName",
    company_name: "companyName",
    organization: "companyName",
    url: "website",
    web: "website",
    birthday: "dateOfBirth",
    dateofbirth: "dateOfBirth",
    date_of_birth: "dateOfBirth",
    dob: "dateOfBirth",
    gender: "gender",
    sex: "gender",
    timezone: "timezone",
    source: "source",
    tags: "tags",
  };

  for (const field of sourceFields) {
    const norm = normalize(field.key);
    const ghlKey = normMap[norm] || aliases[norm];

    if (ghlKey) {
      mappings.push({
        sourceField: field.key,
        targetField: ghlKey,
        targetType: "standard",
      });
    } else {
      mappings.push({
        sourceField: field.key,
        targetField: `custom:${field.key}`,
        targetType: "custom",
      });
    }
  }

  return mappings;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, "").trim();
}

/**
 * Paginated fetch helper. Wraps a page-based API into an AsyncGenerator.
 */
export async function* paginatedFetch<TRaw, TResult>(
  fetchPage: (page: number) => Promise<{ data: TRaw[]; hasMore: boolean }>,
  mapper: (raw: TRaw) => TResult,
  batchSize = 100
): AsyncGenerator<TResult[], void, unknown> {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchPage(page);
    if (result.data.length > 0) {
      yield result.data.map(mapper);
    }
    hasMore = result.hasMore;
    page++;
  }
}

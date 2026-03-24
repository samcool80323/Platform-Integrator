import { GHLClient } from "./client";

export interface GHLAppointment {
  id: string;
  calendarId: string;
  contactId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
}

export async function getCalendars(
  client: GHLClient,
  locationId: string
): Promise<{ id: string; name: string }[]> {
  const result = await client.get<{ calendars: { id: string; name: string }[] }>(
    "/calendars",
    { locationId }
  );
  return result.calendars || [];
}

export async function createAppointment(
  client: GHLClient,
  data: {
    calendarId: string;
    contactId: string;
    title: string;
    startTime: string;
    endTime: string;
    status?: string;
    notes?: string;
  }
): Promise<GHLAppointment> {
  const result = await client.post<{ event: GHLAppointment }>(
    "/calendars/events/appointments",
    data
  );
  return result.event;
}

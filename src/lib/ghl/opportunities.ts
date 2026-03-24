import { GHLClient } from "./client";

export interface GHLPipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  monetaryValue?: number;
  status: string;
}

export async function getPipelines(
  client: GHLClient,
  locationId: string
): Promise<GHLPipeline[]> {
  const result = await client.get<{ pipelines: GHLPipeline[] }>(
    "/opportunities/pipelines",
    { locationId }
  );
  return result.pipelines || [];
}

export async function createOpportunity(
  client: GHLClient,
  data: {
    locationId: string;
    name: string;
    pipelineId: string;
    pipelineStageId: string;
    contactId: string;
    monetaryValue?: number;
    status?: string;
  }
): Promise<GHLOpportunity> {
  const result = await client.post<{ opportunity: GHLOpportunity }>(
    "/opportunities",
    data
  );
  return result.opportunity;
}

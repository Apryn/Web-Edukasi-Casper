import { handleDrillSolutionRequest } from "@/lib/drill-api-handlers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleDrillSolutionRequest(req, id);
}

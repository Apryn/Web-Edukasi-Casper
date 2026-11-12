import { handleDrillSubmitRequest } from "@/lib/drill-api-handlers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleDrillSubmitRequest(req, id);
}

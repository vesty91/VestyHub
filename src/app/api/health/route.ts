import { GET as readinessHandler } from "./ready/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return readinessHandler();
}

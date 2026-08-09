import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { hasDbConfig } from "@/lib/db";

const handler = async (request: Request) => {
  if (!hasDbConfig()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }
  return getAuth().handler(request);
};

export { handler as GET, handler as POST };

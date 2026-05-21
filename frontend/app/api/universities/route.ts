import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!name.trim()) return NextResponse.json([]);
  try {
    const res = await fetch(
      `http://universities.hipolabs.com/search?name=${encodeURIComponent(name)}`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}

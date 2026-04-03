import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cookieToken = req.cookies.get("auth_token")?.value;
    const token = authHeader?.split(" ")[1] || cookieToken;

    if (!token) {
      return NextResponse.json({ error: "未授权或未登录" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.uid) {
      return NextResponse.json({ error: "无效的 Token 或已过期" }, { status: 401 });
    }

    const uid = payload.uid as string;
    
    let body;
    try {
      body = await req.json();
    } catch {
       return NextResponse.json({ error: "无效的请求负荷" }, { status: 400 });
    }
    
    const { size } = body;

    if (typeof size !== "number" || size <= 0) {
      return NextResponse.json({ error: "参数 size 必须为大于0的数字字节" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { uid },
      data: {
        storage_usage: {
          increment: size
        }
      }
    });

    return NextResponse.json({
      success: true,
      newUsage: user.storage_usage
    });

  } catch (error: any) {
    console.error("确认上传统调出错:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

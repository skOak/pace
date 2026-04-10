import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const QUOTA_FREE = 100 * 1024 * 1024; // 100MB
const QUOTA_PRO = 1024 * 1024 * 1024; // 1GB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 单个文件上限 50MB

const s3Client = new S3Client({
  region: process.env.OSS_REGION || "auto",
  endpoint: process.env.OSS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.OSS_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: process.env.OSS_FORCE_PATH_STYLE === "true", 
});

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

    const { filename, contentType, size } = body;

    if (!filename || !contentType || typeof size !== "number") {
      return NextResponse.json({ error: "参数不完整：filename, contentType, size 均为必填项" }, { status: 400 });
    }

    if (size <= 0 || size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `单文件大小不得超过 ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { uid } });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const maxQuota = user.level === "PRO" ? QUOTA_PRO : QUOTA_FREE;
    if (user.storage_usage + size > maxQuota) {
      return NextResponse.json({ 
        error: "存储容量不足，请升级至高级版(PRO)以获取 1GB 空间，或清理旧文件。", 
        quotaExceeded: true,
        currentUsage: user.storage_usage,
        maxQuota: maxQuota
      }, { status: 403 });
    }

    const ext = filename.split(".").pop();
    
    // 安全控制允许的子目录
    const requestedFolder = body.folder || 'uploads';
    const safeFolder = ['feedbacks', 'avatars'].includes(requestedFolder) ? requestedFolder : 'uploads';
    
    const uniqueKey = `${safeFolder}/${uid}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const bucket = process.env.OSS_BUCKET || "pace-storage";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueKey,
      ContentType: contentType,
      ContentLength: size
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const publicDomain = process.env.OSS_PUBLIC_DOMAIN || process.env.OSS_ENDPOINT || "";
    const baseUrl = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
    let fileUrl = "";
    
    if (process.env.OSS_PUBLIC_DOMAIN) {
      fileUrl = `${baseUrl}/${uniqueKey}`;
    } else {
      if (process.env.OSS_FORCE_PATH_STYLE === "true") {
         fileUrl = `${baseUrl}/${bucket}/${uniqueKey}`;
      } else {
         try {
           const urlObj = new URL(baseUrl);
           fileUrl = `${urlObj.protocol}//${bucket}.${urlObj.host}/${uniqueKey}`;
         } catch {
           fileUrl = `${baseUrl}/${bucket}/${uniqueKey}`;
         }
      }
    }

    return NextResponse.json({ uploadUrl, fileUrl, key: uniqueKey });

  } catch (error: any) {
    console.error("生成上传凭证错误:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

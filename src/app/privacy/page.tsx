import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 text-center">用户隐私协议</h1>
      
      <div className="prose prose-slate max-w-none text-gray-700 space-y-6">
        <p className="font-medium">生效日期：2026年04月</p>
        
        <p>感谢您使用 Pace。我们非常重视您的隐私，并承诺在提供服务的同时保护您的个人数据。本《隐私条款》概述了当您访问和使用本应用时，我们如何收集、使用和保护您的信息。</p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 border-b pb-2">1. 我们收集什么信息？</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>账户识别信息：</strong> 当您注册或登录时，我们可能要求您提供手机号以验证您的身份。为了实现离线数据接管至云端，我们会记录您的设备身份。</li>
          <li><strong>应用内产生的数据：</strong> 所有在您的设备本地生成的任务、习惯打卡、备忘录等数据，在未登录时100%留存本地。当您登录进行跨设备同步时，这部分内容将加密传输至我们的云端数据库。</li>
          <li><strong>安全及防护追踪信息：</strong> 为保障服务处于安全的网络环境，预防防刷量及接口滥用（如 OCR 次数控制），当我们侦测到登录动作发生时，系统将记录并更新您的客户端 IP 地址、所使用的浏览器标识符 (User-Agent)、首次激活时间和最近一次使用时间。</li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 border-b pb-2">2. 我们如何使用这些信息？</h2>
        <p>我们保证，所有收集的信息仅用于以下核心目的：</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>为您提供稳定跨设备同步的 Pace 任务管理服务。</li>
          <li>系统日志分析、服务器容量预估与故障排查。</li>
          <li>拦截恶意请求、防止机器人或代理集群滥用稀缺计算资源的请求拦截处理。</li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 border-b pb-2">3. 数据的安全保障</h2>
        <p>我们采用行业标准的加密手段（包括全站强制 HTTPS/TLS 链路层加密）、基于验证码登录分发的短时效 JSON Web Token 进行身份隔离，并在数据库层设置防渗漏的安全策略。任何人员均不会无故访问包含隐秘身份的私人日志。</p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 border-b pb-2">4. 您的知情同意权与数据消除控制权</h2>
        <p>如您在弹窗和登录页面点击获取验证码或确认按钮，即代表您已知晓本政策细节并授权设备被系统托管接管。<br/>作为数据完整所有权者，如果您不再使用 Pace，您可以随时在应用内执行「恢复出厂设置清空」，您的所有结构化离线索引数据库将瞬间被销毁。</p>

        <div className="bg-gray-50 border p-4 rounded-lg mt-8 text-sm">
          <p className="mb-0">如果您对我们的隐私实践或安全策略有任何进一步问题，请联系系统管理员排查处理。</p>
        </div>
      </div>
    </div>
  );
}

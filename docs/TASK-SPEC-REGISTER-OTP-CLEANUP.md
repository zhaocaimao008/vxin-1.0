# TASK SPEC: REGISTER-OTP-CLEANUP

## Goal
删除 Web 注册页（web/src/pages/Register.jsx）中的验证码（OTP）相关 UI 与逻辑，与 Android/iOS 注册页保持一致（已删）。

## Background
- 项目无真实短信验证码注册功能：后端 /api/auth/send-verify-code 不存在（404）
- 但 Web 注册页仍渲染验证码输入框 + 「获取验证码」按钮 + 倒计时，且提交时强制校验 6 位验证码 → 注册 UX 必报错（半坏状态）
- Android/iOS 注册页已删除验证码字段
- 后端 register 接口实际忽略 verifyCode 字段，仅需 phone/username/password/inviteCode（选填）

## Changes (web/src/pages/Register.jsx only)
删除以下全部内容：
1. 表单初始 state 中的 verifyCode 字段
2. sendingCode / countdown state 及其 useEffect 倒计时逻辑
3. handleSendCode（发送验证码）函数与 /api/auth/send-verify-code 调用
4. 提交前 `if (!form.verifyCode || form.verifyCode.length !== 6)` 校验
5. 注册请求 payload 中的 verifyCode 字段
6. fields 数组中的 verifyCode 字段定义（含 hasButton）
7. JSX 中验证码输入框渲染 + 「获取验证码」按钮 + 倒计时文案（auth-verify-code-btn 等）
8. 提交按钮 disabled 条件中的 !form.verifyCode

保留：
- 手机号、密码、邀请码（选填）、协议勾选、注册按钮
- invite 参数预填邀请码逻辑
- 后端/其他文件一律不动（无 schema 变更、无 migration）

## Acceptance criteria
1. Web 注册页不再有任何验证码输入框/获取验证码按钮/倒计时/验证码校验
2. 手机号 + 密码 + 邀请码(选填) + 协议 即可完成注册提交
3. 提交 payload 无 verifyCode 字段
4. ESLint 通过、无未使用变量（sendingCode/countdown/handleSendCode 等残留引用必须清干净）
5. 仅改动 Register.jsx 一个文件

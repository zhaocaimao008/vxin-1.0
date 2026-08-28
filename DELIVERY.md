# v信(Vxin)源码交付说明

本包为 v信私有化部署通讯应用的完整源码交付包。

## 包内包含
- **完整源码**:Web / Android / iOS / 桌面 Electron / 后端服务 / 管理后台
- **部署脚本**:`deploy/` 目录 + `docs/换服务器与打包手册.md`
- **环境模板**:`.env.example` 体系(密钥由买家自行填写)
- **商业授权**:`LICENSE`(签署后生效)

## 快速开始
1. 阅读 `docs/DELIVERABLE_CHECKLIST.md`(功能清单与限制)
2. 按 `docs/换服务器与打包手册.md` 部署后端与前端
3. 按 `docs/IOS_SIGNING_SETUP.md` 完成 iOS 签名

## 注意
- 源码含 Firebase/推送配置文件,商用前请替换为买家自己的项目凭据
- 本包不包含:授权方密钥、签名 keystore、生产数据(详见 LICENSE 条款)

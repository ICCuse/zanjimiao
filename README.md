# 攒机喵 · 台式电脑配置助手

微信小程序，帮助用户配置台式电脑硬件。支持组件兼容性检查、方案保存与分享。

> **开发历程**：本项目的全部代码由 AI 辅助生成，作者未手写一行代码。从零到上线历时 3 个月，踩过无数坑。如果你也想用 AI 写小程序、但不想一个人踩完所有的坑——请看下方"作者"栏。

## 功能

- **智能配置**：选择 CPU/主板/内存/显卡/硬盘/电源/机箱/散热器，自动检查兼容性
- **方案管理**：保存、分享、收藏配置方案
- **预设方案**：5 套从入门到高端的推荐配置，带性能评分
- **组件搜索**：多维度关键词搜索（品牌/型号/规格/接口）
- **对比工具**：多方案横向对比
- **AI 推荐**：根据用途和预算生成推荐配置

## 技术栈

- 微信小程序原生框架（WXML / WXSS / JS）
- 微信云开发（云数据库 + 云函数 + 云存储）
- 分包加载（5 个子包）

## 项目结构

```
├── pages/              # 主包页面
│   ├── config/         # 配置生成（核心页面）
│   ├── home/           # 首页
│   ├── profile/        # 个人中心
│   ├── compare/        # 方案对比
│   ├── recommendation/ # AI 推荐
│   └── shared/         # 共享组件
├── packageAdmin/       # 管理后台分包
├── packageConfig/      # 配置分包
├── packageDetail/      # 详情+方案分包
├── packageImage/       # 图片资源分包
├── packagePlans/       # 方案列表分包
├── cloudfunctions/     # 7 个云函数
├── utils/              # 工具库
└── static/images/      # 图片资源
```

## 运行

1. 注册微信小程序，获取 AppID
2. 开通云开发，获取云环境 ID
3. 将 `project.config.json` 中的 `appid` 替换为你的 AppID
4. 全局搜索 `your-cloud-env-id` 替换为你的云环境 ID
5. 导入云数据库集合（cpu_data / motherboard_data / memory_data / gpu_data / disk_data / power_data / case_data / cooler_data）
6. 微信开发者工具打开项目，上传

## 许可

MIT License

## 作者

承接微信小程序开发、定制、技术咨询。完整项目交付，源码 + 部署。有意请联系：

wangkukushe@163.com

# TODO

- [ ] 发布步骤
  1. 版本确认，通过 git tag、git release 确定当前版本号 
  2. 确认做了什么，通过 git commit、plan 和 spec 文档，来了解这个版本做了什么 
  3. 创建新版本
    1. 修改本地版本号，分析项目通过什么传入构建版本号，并进行修改、构建，如当前项目是在 package.json 中指定
    2. 创建 git tag、git release，并且在 release 中写入“新版本做了什么”
    3. 同步宣传网页下载地址，如当前项目是在 docs\index.html


# BUG
